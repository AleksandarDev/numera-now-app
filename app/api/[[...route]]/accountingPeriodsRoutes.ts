import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, gte, lte, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import {
    accountingPeriods,
    accounts,
    insertAccountingPeriodSchema,
    transactions,
} from '@/db/schema';

const app = new Hono()
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const data = await db
            .select()
            .from(accountingPeriods)
            .where(eq(accountingPeriods.userId, auth.userId))
            .orderBy(desc(accountingPeriods.startDate));

        return ctx.json({ data });
    })
    .get(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!data) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/',
        clerkMiddleware(),
        zValidator('json', insertAccountingPeriodSchema.omit({ id: true })),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Check for overlapping periods
            const overlappingPeriods = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.userId, auth.userId),
                        or(
                            // New period starts during an existing period
                            and(
                                lte(
                                    accountingPeriods.startDate,
                                    values.startDate,
                                ),
                                gte(
                                    accountingPeriods.endDate,
                                    values.startDate,
                                ),
                            ),
                            // New period ends during an existing period
                            and(
                                lte(
                                    accountingPeriods.startDate,
                                    values.endDate,
                                ),
                                gte(accountingPeriods.endDate, values.endDate),
                            ),
                            // New period completely encompasses an existing period
                            and(
                                gte(
                                    accountingPeriods.startDate,
                                    values.startDate,
                                ),
                                lte(accountingPeriods.endDate, values.endDate),
                            ),
                        ),
                    ),
                );

            if (overlappingPeriods.length > 0) {
                return ctx.json(
                    {
                        error: 'This period overlaps with an existing accounting period.',
                        overlappingPeriods,
                    },
                    400,
                );
            }

            const [data] = await db
                .insert(accountingPeriods)
                .values({
                    id: createId(),
                    userId: auth.userId,
                    ...values,
                })
                .returning();

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id/close',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                notes: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const { notes } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get the period
            const [period] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!period) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            if (period.status === 'closed') {
                return ctx.json({ error: 'Period is already closed.' }, 400);
            }

            // Close the period
            const [data] = await db
                .update(accountingPeriods)
                .set({
                    status: 'closed',
                    closedAt: new Date(),
                    closedBy: auth.userId,
                    notes: notes || period.notes,
                })
                .where(eq(accountingPeriods.id, id))
                .returning();

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id/reopen',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get the period
            const [period] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!period) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            if (period.status === 'open') {
                return ctx.json({ error: 'Period is already open.' }, 400);
            }

            // Reopen the period
            const [data] = await db
                .update(accountingPeriods)
                .set({
                    status: 'open',
                    closedAt: null,
                    closedBy: null,
                })
                .where(eq(accountingPeriods.id, id))
                .returning();

            return ctx.json({ data });
        },
    )
    .delete(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .delete(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/preview-closing',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                startDate: z.coerce.date(),
                endDate: z.coerce.date(),
                profitAndLossAccountId: z.string(),
                retainedEarningsAccountId: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const {
                startDate,
                endDate,
                profitAndLossAccountId,
                retainedEarningsAccountId,
            } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get all income and expense accounts with their balances for the period
            const accountBalances = await db
                .select({
                    accountId: accounts.id,
                    accountName: accounts.name,
                    accountCode: accounts.code,
                    accountClass: accounts.accountClass,
                    accountType: accounts.accountType,
                    balance: transactions.amount,
                })
                .from(transactions)
                .innerJoin(
                    accounts,
                    or(
                        eq(transactions.accountId, accounts.id),
                        eq(transactions.creditAccountId, accounts.id),
                        eq(transactions.debitAccountId, accounts.id),
                    ),
                )
                .where(
                    and(
                        eq(accounts.userId, auth.userId),
                        or(
                            eq(accounts.accountClass, 'income'),
                            eq(accounts.accountClass, 'expense'),
                        ),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                    ),
                );

            // Aggregate balances by account
            const balanceMap = new Map<
                string,
                {
                    accountId: string;
                    accountName: string;
                    accountCode: string | null;
                    accountClass: string | null;
                    accountType: string;
                    balance: number;
                }
            >();

            for (const row of accountBalances) {
                const key = row.accountId;
                const existing = balanceMap.get(key);
                const amount = row.balance || 0;

                if (existing) {
                    existing.balance += amount;
                } else {
                    balanceMap.set(key, {
                        accountId: row.accountId,
                        accountName: row.accountName,
                        accountCode: row.accountCode,
                        accountClass: row.accountClass,
                        accountType: row.accountType,
                        balance: amount,
                    });
                }
            }

            const balances = Array.from(balanceMap.values());
            const incomeAccounts = balances.filter(
                (b) => b.accountClass === 'income',
            );
            const expenseAccounts = balances.filter(
                (b) => b.accountClass === 'expense',
            );

            const totalIncome = incomeAccounts.reduce(
                (sum, acc) => sum + acc.balance,
                0,
            );
            const totalExpenses = expenseAccounts.reduce(
                (sum, acc) => sum + acc.balance,
                0,
            );
            const netResult = totalIncome + totalExpenses; // Expenses are typically negative

            // Validate accounts exist
            const [profitAndLossAccount] = await db
                .select()
                .from(accounts)
                .where(
                    and(
                        eq(accounts.id, profitAndLossAccountId),
                        eq(accounts.userId, auth.userId),
                    ),
                );

            if (!profitAndLossAccount) {
                return ctx.json(
                    { error: 'Profit and loss account not found.' },
                    404,
                );
            }

            let retainedEarningsAccount = null;
            if (retainedEarningsAccountId) {
                [retainedEarningsAccount] = await db
                    .select()
                    .from(accounts)
                    .where(
                        and(
                            eq(accounts.id, retainedEarningsAccountId),
                            eq(accounts.userId, auth.userId),
                        ),
                    );

                if (!retainedEarningsAccount) {
                    return ctx.json(
                        { error: 'Retained earnings account not found.' },
                        404,
                    );
                }
            }

            return ctx.json({
                data: {
                    incomeAccounts,
                    expenseAccounts,
                    totalIncome,
                    totalExpenses,
                    netResult,
                    profitAndLossAccount: {
                        id: profitAndLossAccount.id,
                        name: profitAndLossAccount.name,
                        code: profitAndLossAccount.code,
                    },
                    retainedEarningsAccount: retainedEarningsAccount
                        ? {
                              id: retainedEarningsAccount.id,
                              name: retainedEarningsAccount.name,
                              code: retainedEarningsAccount.code,
                          }
                        : null,
                },
            });
        },
    );

export default app;
