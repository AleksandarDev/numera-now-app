import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import {
    customerIbans,
    customers,
    insertCustomerSchema,
    transactions,
} from '@/db/schema';

// Helper function to check if customer data is complete
type CustomerData = {
    name?: string | null;
    pin?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    contactEmail?: string | null;
    contactTelephone?: string | null;
};

const isCustomerComplete = (customer: CustomerData): boolean => {
    return !!(
        customer.name &&
        (customer.pin || customer.vatNumber) &&
        customer.address &&
        customer.contactEmail &&
        customer.contactTelephone
    );
};

const app = new Hono()
    .get('/incomplete-count', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [result] = await db
            .select({
                count: sql<number>`count(*)`.as('count'),
            })
            .from(customers)
            .where(
                and(
                    eq(customers.userId, auth.userId),
                    eq(customers.isComplete, false),
                ),
            );

        return ctx.json({ count: Number(result?.count || 0) });
    })
    .get(
        '/',
        zValidator(
            'query',
            z.object({
                search: z.string().optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { search } = ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const data = await db
                .select({
                    id: customers.id,
                    name: customers.name,
                    pin: customers.pin,
                    vatNumber: customers.vatNumber,
                    address: customers.address,
                    contactEmail: customers.contactEmail,
                    contactTelephone: customers.contactTelephone,
                    isComplete: customers.isComplete,
                    transactionCount: sql<number>`count(${transactions.id})`.as(
                        'transaction_count',
                    ),
                })
                .from(customers)
                .leftJoin(
                    transactions,
                    eq(customers.id, transactions.payeeCustomerId),
                )
                .where(
                    search
                        ? and(
                              eq(customers.userId, auth.userId),
                              or(
                                  ilike(customers.name, `%${search}%`),
                                  sql`${customers.pin} ILIKE ${`%${search}%`}`,
                              ),
                          )
                        : eq(customers.userId, auth.userId),
                )
                .groupBy(customers.id)
                .orderBy(desc(customers.name));

            return ctx.json({ data });
        },
    )
    .get(
        '/:id',
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .select()
                .from(customers)
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                );

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    // Get IBANs for a customer
    .get(
        '/:id/ibans',
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Verify customer belongs to user
            const [customer] = await db
                .select()
                .from(customers)
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                );

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const data = await db
                .select()
                .from(customerIbans)
                .where(eq(customerIbans.customerId, id))
                .orderBy(desc(customerIbans.createdAt));

            return ctx.json({ data });
        },
    )
    // Add IBAN to customer
    .post(
        '/:id/ibans',
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                iban: z.string().min(1),
                bankName: z.string().optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Verify customer belongs to user
            const [customer] = await db
                .select()
                .from(customers)
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                );

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const [data] = await db
                .insert(customerIbans)
                .values({
                    id: createId(),
                    customerId: id,
                    iban: values.iban.toUpperCase().replace(/\s/g, ''), // Normalize IBAN
                    bankName: values.bankName || null,
                })
                .returning();

            return ctx.json({ data });
        },
    )
    // Delete IBAN
    .delete(
        '/:id/ibans/:ibanId',
        zValidator(
            'param',
            z.object({
                id: z.string(),
                ibanId: z.string(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id, ibanId } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Verify customer belongs to user
            const [customer] = await db
                .select()
                .from(customers)
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                );

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const [data] = await db
                .delete(customerIbans)
                .where(
                    and(
                        eq(customerIbans.id, ibanId),
                        eq(customerIbans.customerId, id),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'IBAN not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    // Lookup customer by IBAN (for import matching)
    .get(
        '/lookup/iban',
        zValidator(
            'query',
            z.object({
                iban: z.string(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { iban } = ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Normalize IBAN for lookup
            const normalizedIban = iban.toUpperCase().replace(/\s/g, '');

            const [ibanRecord] = await db
                .select({
                    customerId: customerIbans.customerId,
                    customerName: customers.name,
                    iban: customerIbans.iban,
                    bankName: customerIbans.bankName,
                })
                .from(customerIbans)
                .innerJoin(
                    customers,
                    eq(customerIbans.customerId, customers.id),
                )
                .where(
                    and(
                        eq(customerIbans.iban, normalizedIban),
                        eq(customers.userId, auth.userId),
                    ),
                );

            if (!ibanRecord) {
                return ctx.json({ data: null });
            }

            return ctx.json({ data: ibanRecord });
        },
    )
    .post(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            insertCustomerSchema.omit({
                id: true,
                userId: true,
                isComplete: true,
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const isComplete = isCustomerComplete(values);

            const [data] = await db
                .insert(customers)
                .values({
                    id: createId(),
                    userId: auth.userId,
                    isComplete,
                    ...values,
                })
                .returning();

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        zValidator(
            'json',
            insertCustomerSchema.omit({
                id: true,
                userId: true,
                isComplete: true,
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const values = ctx.req.valid('json');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const isComplete = isCustomerComplete(values);

            const [data] = await db
                .update(customers)
                .set({
                    isComplete,
                    ...values,
                })
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .delete(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Check if customer has linked transactions
            const [linkedTransaction] = await db
                .select({ id: transactions.id })
                .from(transactions)
                .where(eq(transactions.payeeCustomerId, id))
                .limit(1);

            if (linkedTransaction) {
                return ctx.json(
                    {
                        error: 'Cannot delete customer with linked transactions. Please reassign or delete the transactions first.',
                    },
                    400,
                );
            }

            const [data] = await db
                .delete(customers)
                .where(
                    and(
                        eq(customers.id, id),
                        eq(customers.userId, auth.userId),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    );

export default app;
