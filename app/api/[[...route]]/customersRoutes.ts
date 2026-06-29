import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import {
    auditEvents,
    customerIbans,
    customers,
    insertCustomerSchema,
} from '@/db/schema';
import { type AuditAction, writeAuditEvent } from '@/lib/audit';
import {
    createCustomerIbanRestorePatch,
    createCustomerIbanSoftDeletePatch,
    createCustomerProfileRevertPatch,
    createCustomerRestorePatch,
    createCustomerSoftDeletePatch,
    getCustomerIbanRevertConflicts,
    getCustomerLifecycleRevertConflicts,
    getCustomerProfileRevertConflicts,
    type SnapshotRecord,
} from '@/lib/customer-lifecycle';
import { listCustomers } from '@/lib/services/finance-entities';

type DeletedMode = 'include' | 'only';
type CustomerRow = typeof customers.$inferSelect;
type CustomerIbanRow = typeof customerIbans.$inferSelect;
type CustomerUpdate = Partial<typeof customers.$inferInsert>;

type CustomerData = {
    name?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    contactEmail?: string | null;
    contactTelephone?: string | null;
    country?: string | null;
};

const customerLifecycleSchema = z.object({
    reason: z.string().max(500).optional(),
});

const customerRevertSchema = customerLifecycleSchema.extend({
    auditEventId: z.string().min(1),
});

const customerPayloadSchema = insertCustomerSchema.omit({
    id: true,
    userId: true,
    isComplete: true,
    isDeleted: true,
    deletedAt: true,
    deletedBy: true,
    deleteReason: true,
    restoredAt: true,
    restoredBy: true,
    restoreReason: true,
});

const isCustomerComplete = (customer: CustomerData): boolean => {
    return !!(
        customer.name &&
        customer.vatNumber &&
        customer.address &&
        customer.contactEmail &&
        customer.contactTelephone &&
        customer.country
    );
};

const normalizeIban = (iban: string) => iban.toUpperCase().replace(/\s/g, '');

const readJsonPayload = async (ctx: Context) => {
    const contentType = ctx.req.header('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return {};
    }

    try {
        return await ctx.req.json();
    } catch {
        return {};
    }
};

const readLifecycleReason = async (ctx: Context) => {
    const parsed = customerLifecycleSchema.safeParse(
        await readJsonPayload(ctx),
    );
    return parsed.success ? (parsed.data.reason ?? null) : null;
};

const customerDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(customers.isDeleted, true);
    }

    return eq(customers.isDeleted, false);
};

const customerIbanDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(customerIbans.isDeleted, true);
    }

    return eq(customerIbans.isDeleted, false);
};

const enforceMinDelay = async (
    startTimeMs: number,
    minDelayMs: number,
): Promise<void> => {
    const elapsedMs = Date.now() - startTimeMs;
    const remainingMs = minDelayMs - elapsedMs;
    if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }
};

const getAuthorizedCustomer = async ({
    id,
    userId,
    deleted,
}: {
    id: string;
    userId: string;
    deleted?: DeletedMode;
}) => {
    const [customer] = await db
        .select()
        .from(customers)
        .where(
            and(
                eq(customers.id, id),
                eq(customers.userId, userId),
                customerDeletedFilter(deleted),
            ),
        );

    return customer ?? null;
};

const getAuthorizedCustomerIban = async ({
    customerId,
    ibanId,
    userId,
    deleted,
    customerDeleted,
}: {
    customerId: string;
    ibanId: string;
    userId: string;
    deleted?: DeletedMode;
    customerDeleted?: DeletedMode;
}) => {
    const customer = await getAuthorizedCustomer({
        id: customerId,
        userId,
        deleted: customerDeleted,
    });

    if (!customer) {
        return null;
    }

    const [iban] = await db
        .select()
        .from(customerIbans)
        .where(
            and(
                eq(customerIbans.id, ibanId),
                eq(customerIbans.customerId, customerId),
                customerIbanDeletedFilter(deleted),
            ),
        );

    if (!iban) {
        return null;
    }

    return { customer, iban };
};

const writeCustomerAuditEvent = async ({
    action,
    userId,
    before,
    after,
    reason,
    source,
    revertedFromEventId,
}: {
    action: AuditAction;
    userId: string;
    before?: CustomerRow | null;
    after?: CustomerRow | null;
    reason?: string | null;
    source: string;
    revertedFromEventId?: string | null;
}) => {
    const resource = after ?? before;
    if (!resource) return;

    await writeAuditEvent(db, {
        userId,
        actorUserId: userId,
        actorType: 'user',
        action,
        resourceType: 'customer',
        resourceId: resource.id,
        resourceLabel: resource.friendlyName ?? resource.name,
        before: before ?? null,
        after: after ?? null,
        sourceMetadata: {
            source,
            reason: reason ?? null,
        },
        revertedFromEventId,
    });
};

const writeCustomerIbanAuditEvent = async ({
    action,
    userId,
    before,
    after,
    reason,
    source,
    revertedFromEventId,
}: {
    action: AuditAction;
    userId: string;
    before?: CustomerIbanRow | null;
    after?: CustomerIbanRow | null;
    reason?: string | null;
    source: string;
    revertedFromEventId?: string | null;
}) => {
    const resource = after ?? before;
    if (!resource) return;

    await writeAuditEvent(db, {
        userId,
        actorUserId: userId,
        actorType: 'user',
        action,
        resourceType: 'customer_iban',
        resourceId: resource.id,
        resourceLabel: resource.iban,
        before: before ?? null,
        after: after ?? null,
        sourceMetadata: {
            source,
            reason: reason ?? null,
            customerId: resource.customerId,
        },
        revertedFromEventId,
    });
};

const unmarkOtherOwnFirmCustomers = async ({
    userId,
    exceptId,
    source,
}: {
    userId: string;
    exceptId?: string;
    source: string;
}) => {
    const beforeRows = await db
        .select()
        .from(customers)
        .where(
            and(
                eq(customers.userId, userId),
                eq(customers.isOwnFirm, true),
                eq(customers.isDeleted, false),
                exceptId ? ne(customers.id, exceptId) : undefined,
            ),
        );

    if (beforeRows.length === 0) {
        return;
    }

    const updatedRows = await db
        .update(customers)
        .set({ isOwnFirm: false })
        .where(
            inArray(
                customers.id,
                beforeRows.map((customer) => customer.id),
            ),
        )
        .returning();
    const beforeById = new Map(beforeRows.map((row) => [row.id, row]));

    for (const updatedRow of updatedRows) {
        await writeCustomerAuditEvent({
            action: 'update',
            userId,
            before: beforeById.get(updatedRow.id) ?? null,
            after: updatedRow,
            source,
        });
    }
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const toSnapshotRecord = (value: unknown): SnapshotRecord | null => {
    if (!isPlainRecord(value)) {
        return null;
    }

    return value as SnapshotRecord;
};

const getCustomerAuditEvent = async ({
    auditEventId,
    customerId,
    userId,
}: {
    auditEventId: string;
    customerId: string;
    userId: string;
}) => {
    const [event] = await db
        .select()
        .from(auditEvents)
        .where(
            and(
                eq(auditEvents.id, auditEventId),
                eq(auditEvents.userId, userId),
                or(
                    and(
                        eq(auditEvents.resourceType, 'customer'),
                        eq(auditEvents.resourceId, customerId),
                    ),
                    and(
                        eq(auditEvents.resourceType, 'customer_iban'),
                        sql`${auditEvents.sourceMetadata}->>'customerId' = ${customerId}`,
                    ),
                ),
            ),
        );

    return event ?? null;
};

const revertCustomerAuditEvent = async ({
    ctx,
    customer,
    event,
    reason,
    userId,
}: {
    ctx: Context;
    customer: CustomerRow;
    event: typeof auditEvents.$inferSelect;
    reason: string | null;
    userId: string;
}) => {
    const before = toSnapshotRecord(event.before);
    const after = toSnapshotRecord(event.after);

    if (!after || (event.action !== 'create' && !before)) {
        return ctx.json({ error: 'Audit event cannot be reverted.' }, 400);
    }

    const currentSnapshot = customer as unknown as SnapshotRecord;
    const conflicts =
        event.action === 'update'
            ? getCustomerProfileRevertConflicts({
                  current: currentSnapshot,
                  eventAfter: after,
              })
            : getCustomerLifecycleRevertConflicts({
                  current: currentSnapshot,
                  eventAfter: after,
              });

    if (conflicts.length > 0) {
        return ctx.json(
            {
                error: 'Customer changed since the audit event.',
                conflicts,
            },
            409,
        );
    }

    if (event.action === 'update' && before) {
        const patch = createCustomerProfileRevertPatch(before);

        if (patch.isOwnFirm === true) {
            await unmarkOtherOwnFirmCustomers({
                userId,
                exceptId: customer.id,
                source: 'customers_revert_unmark_own_firm',
            });
        }

        const [updatedCustomer] = await db
            .update(customers)
            .set(patch as CustomerUpdate)
            .where(eq(customers.id, customer.id))
            .returning();

        await writeCustomerAuditEvent({
            action: 'update',
            userId,
            before: customer,
            after: updatedCustomer,
            reason,
            source: 'customers_revert',
            revertedFromEventId: event.id,
        });

        return ctx.json({ data: updatedCustomer });
    }

    if (event.action === 'delete') {
        if (!customer.isDeleted) {
            return ctx.json(
                { error: 'Customer is not currently deleted.' },
                409,
            );
        }

        if (customer.isOwnFirm) {
            await unmarkOtherOwnFirmCustomers({
                userId,
                exceptId: customer.id,
                source: 'customers_revert_delete_unmark_own_firm',
            });
        }

        const [updatedCustomer] = await db
            .update(customers)
            .set(createCustomerRestorePatch({ userId, reason }))
            .where(eq(customers.id, customer.id))
            .returning();

        await writeCustomerAuditEvent({
            action: 'restore',
            userId,
            before: customer,
            after: updatedCustomer,
            reason,
            source: 'customers_revert_delete',
            revertedFromEventId: event.id,
        });

        return ctx.json({ data: updatedCustomer });
    }

    if (event.action === 'create' || event.action === 'restore') {
        if (customer.isDeleted) {
            return ctx.json({ error: 'Customer is already deleted.' }, 409);
        }

        const [updatedCustomer] = await db
            .update(customers)
            .set(createCustomerSoftDeletePatch({ userId, reason }))
            .where(eq(customers.id, customer.id))
            .returning();

        await writeCustomerAuditEvent({
            action: 'delete',
            userId,
            before: customer,
            after: updatedCustomer,
            reason,
            source:
                event.action === 'create'
                    ? 'customers_revert_create'
                    : 'customers_revert_restore',
            revertedFromEventId: event.id,
        });

        return ctx.json({ data: updatedCustomer });
    }

    return ctx.json({ error: 'Audit event action is not revertable.' }, 400);
};

const revertCustomerIbanAuditEvent = async ({
    ctx,
    event,
    reason,
    userId,
}: {
    ctx: Context;
    event: typeof auditEvents.$inferSelect;
    reason: string | null;
    userId: string;
}) => {
    const before = toSnapshotRecord(event.before);
    const after = toSnapshotRecord(event.after);

    if (!after || (event.action !== 'create' && !before)) {
        return ctx.json({ error: 'Audit event cannot be reverted.' }, 400);
    }

    const customerId = String(after.customerId ?? before?.customerId ?? '');
    const authorizedIban = await getAuthorizedCustomerIban({
        customerId,
        ibanId: event.resourceId,
        userId,
        deleted: 'include',
        customerDeleted: 'include',
    });

    if (!authorizedIban) {
        return ctx.json({ error: 'IBAN not found.' }, 404);
    }

    const conflicts = getCustomerIbanRevertConflicts({
        current: authorizedIban.iban as unknown as SnapshotRecord,
        eventAfter: after,
    });

    if (conflicts.length > 0) {
        return ctx.json(
            {
                error: 'Customer IBAN changed since the audit event.',
                conflicts,
            },
            409,
        );
    }

    if (event.action === 'delete') {
        const [updatedIban] = await db
            .update(customerIbans)
            .set(createCustomerIbanRestorePatch({ userId, reason }))
            .where(eq(customerIbans.id, authorizedIban.iban.id))
            .returning();

        await writeCustomerIbanAuditEvent({
            action: 'restore',
            userId,
            before: authorizedIban.iban,
            after: updatedIban,
            reason,
            source: 'customer_ibans_revert_delete',
            revertedFromEventId: event.id,
        });

        return ctx.json({ data: updatedIban });
    }

    if (event.action === 'create' || event.action === 'restore') {
        const [updatedIban] = await db
            .update(customerIbans)
            .set(createCustomerIbanSoftDeletePatch({ userId, reason }))
            .where(eq(customerIbans.id, authorizedIban.iban.id))
            .returning();

        await writeCustomerIbanAuditEvent({
            action: 'delete',
            userId,
            before: authorizedIban.iban,
            after: updatedIban,
            reason,
            source:
                event.action === 'create'
                    ? 'customer_ibans_revert_create'
                    : 'customer_ibans_revert_restore',
            revertedFromEventId: event.id,
        });

        return ctx.json({ data: updatedIban });
    }

    return ctx.json({ error: 'Audit event action is not revertable.' }, 400);
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
                    eq(customers.isDeleted, false),
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
                deleted: z.enum(['include', 'only']).optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { search, deleted } = ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const data = await listCustomers({
                userId: auth.userId,
                search,
                deleted,
            });

            return ctx.json({ data });
        },
    )
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

            const startTimeMs = Date.now();
            const normalizedIban = normalizeIban(iban);

            const [ibanRecord] = await db
                .select({
                    customerId: customerIbans.customerId,
                    customerName:
                        sql<string>`coalesce(${customers.friendlyName}, ${customers.name})`.as(
                            'customer_name',
                        ),
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
                        eq(customerIbans.isDeleted, false),
                        eq(customers.userId, auth.userId),
                        eq(customers.isDeleted, false),
                    ),
                );

            if (!ibanRecord) {
                await enforceMinDelay(startTimeMs, 150);
                return ctx.json({ data: null });
            }

            await enforceMinDelay(startTimeMs, 150);
            return ctx.json({ data: ibanRecord });
        },
    )
    .get(
        '/:id/history',
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

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
                deleted: 'include',
            });

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const data = await db
                .select()
                .from(auditEvents)
                .where(
                    and(
                        eq(auditEvents.userId, auth.userId),
                        or(
                            and(
                                eq(auditEvents.resourceType, 'customer'),
                                eq(auditEvents.resourceId, id),
                            ),
                            and(
                                eq(auditEvents.resourceType, 'customer_iban'),
                                sql`${auditEvents.sourceMetadata}->>'customerId' = ${id}`,
                            ),
                        ),
                    ),
                )
                .orderBy(asc(auditEvents.createdAt));

            return ctx.json({ data });
        },
    )
    .post(
        '/:id/revert',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        zValidator('json', customerRevertSchema),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
                deleted: 'include',
            });

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const event = await getCustomerAuditEvent({
                auditEventId: values.auditEventId,
                customerId: id,
                userId: auth.userId,
            });

            if (!event) {
                return ctx.json({ error: 'Audit event not found.' }, 404);
            }

            if (event.revertedFromEventId) {
                return ctx.json(
                    { error: 'Revert audit events cannot be reverted.' },
                    400,
                );
            }

            if (event.resourceType === 'customer') {
                return await revertCustomerAuditEvent({
                    ctx,
                    customer,
                    event,
                    reason: values.reason ?? null,
                    userId: auth.userId,
                });
            }

            if (event.resourceType === 'customer_iban') {
                return await revertCustomerIbanAuditEvent({
                    ctx,
                    event,
                    reason: values.reason ?? null,
                    userId: auth.userId,
                });
            }

            return ctx.json({ error: 'Audit event is not revertable.' }, 400);
        },
    )
    .get(
        '/:id/ibans',
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        zValidator(
            'query',
            z.object({
                deleted: z.enum(['include', 'only']).optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const { deleted } = ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
            });

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const data = await db
                .select()
                .from(customerIbans)
                .where(
                    and(
                        eq(customerIbans.customerId, id),
                        customerIbanDeletedFilter(deleted),
                    ),
                )
                .orderBy(desc(customerIbans.createdAt));

            return ctx.json({ data });
        },
    )
    .post(
        '/:id/ibans',
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
                iban: z.string().min(1),
                bankName: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
            });

            if (!customer) {
                return ctx.json({ error: 'Customer not found.' }, 404);
            }

            const [data] = await db
                .insert(customerIbans)
                .values({
                    id: createId(),
                    customerId: id,
                    iban: normalizeIban(values.iban),
                    bankName: values.bankName || null,
                })
                .returning();

            await writeCustomerIbanAuditEvent({
                action: 'create',
                userId: auth.userId,
                before: null,
                after: data,
                source: 'customer_ibans_create',
            });

            return ctx.json({ data });
        },
    )
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

            const authorizedIban = await getAuthorizedCustomerIban({
                customerId: id,
                ibanId,
                userId: auth.userId,
            });

            if (!authorizedIban) {
                return ctx.json({ error: 'IBAN not found.' }, 404);
            }

            const reason = await readLifecycleReason(ctx);
            const [data] = await db
                .update(customerIbans)
                .set(
                    createCustomerIbanSoftDeletePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(customerIbans.id, ibanId))
                .returning();

            await writeCustomerIbanAuditEvent({
                action: 'delete',
                userId: auth.userId,
                before: authorizedIban.iban,
                after: data,
                reason,
                source: 'customer_ibans_delete',
            });

            return ctx.json({ data });
        },
    )
    .post(
        '/:id/ibans/:ibanId/restore',
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

            const authorizedIban = await getAuthorizedCustomerIban({
                customerId: id,
                ibanId,
                userId: auth.userId,
                deleted: 'only',
                customerDeleted: 'include',
            });

            if (!authorizedIban) {
                return ctx.json({ error: 'IBAN not found.' }, 404);
            }

            const reason = await readLifecycleReason(ctx);
            const [data] = await db
                .update(customerIbans)
                .set(
                    createCustomerIbanRestorePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(customerIbans.id, ibanId))
                .returning();

            await writeCustomerIbanAuditEvent({
                action: 'restore',
                userId: auth.userId,
                before: authorizedIban.iban,
                after: data,
                reason,
                source: 'customer_ibans_restore',
            });

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
        zValidator(
            'query',
            z.object({
                deleted: z.enum(['include', 'only']).optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const { deleted } = ctx.req.valid('query');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const data = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
                deleted,
            });

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/',
        clerkMiddleware(),
        zValidator('json', customerPayloadSchema),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const isComplete = isCustomerComplete(values);

            if (values.isOwnFirm) {
                await unmarkOtherOwnFirmCustomers({
                    userId: auth.userId,
                    source: 'customers_create_unmark_own_firm',
                });
            }

            const [data] = await db
                .insert(customers)
                .values({
                    id: createId(),
                    userId: auth.userId,
                    isComplete,
                    ...values,
                })
                .returning();

            await writeCustomerAuditEvent({
                action: 'create',
                userId: auth.userId,
                before: null,
                after: data,
                source: 'customers_create',
            });

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
        zValidator('json', customerPayloadSchema),
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

            const existingCustomer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
            });

            if (!existingCustomer) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            const isComplete = isCustomerComplete(values);

            if (values.isOwnFirm) {
                await unmarkOtherOwnFirmCustomers({
                    userId: auth.userId,
                    exceptId: id,
                    source: 'customers_update_unmark_own_firm',
                });
            }

            const [data] = await db
                .update(customers)
                .set({
                    isComplete,
                    ...values,
                })
                .where(eq(customers.id, id))
                .returning();

            await writeCustomerAuditEvent({
                action: 'update',
                userId: auth.userId,
                before: existingCustomer,
                after: data,
                source: 'customers_update',
            });

            return ctx.json({ data });
        },
    )
    .post(
        '/bulk-delete',
        clerkMiddleware(),
        zValidator(
            'json',
            customerLifecycleSchema.extend({
                ids: z.array(z.string()),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            if (values.ids.length === 0) {
                return ctx.json({ data: [] });
            }

            const customersToDelete = await db
                .select()
                .from(customers)
                .where(
                    and(
                        inArray(customers.id, values.ids),
                        eq(customers.userId, auth.userId),
                        eq(customers.isDeleted, false),
                    ),
                );

            if (customersToDelete.length !== values.ids.length) {
                return ctx.json(
                    {
                        error: 'One or more customers not found or not authorized.',
                    },
                    403,
                );
            }

            const data = await db
                .update(customers)
                .set(
                    createCustomerSoftDeletePatch({
                        userId: auth.userId,
                        reason: values.reason ?? null,
                    }),
                )
                .where(
                    and(
                        eq(customers.userId, auth.userId),
                        inArray(customers.id, values.ids),
                    ),
                )
                .returning();
            const beforeById = new Map(
                customersToDelete.map((customer) => [customer.id, customer]),
            );

            for (const updatedCustomer of data) {
                await writeCustomerAuditEvent({
                    action: 'delete',
                    userId: auth.userId,
                    before: beforeById.get(updatedCustomer.id) ?? null,
                    after: updatedCustomer,
                    reason: values.reason ?? null,
                    source: 'customers_bulk_delete',
                });
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

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
            });

            if (!customer) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            const reason = await readLifecycleReason(ctx);
            const [data] = await db
                .update(customers)
                .set(
                    createCustomerSoftDeletePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(customers.id, id))
                .returning();

            await writeCustomerAuditEvent({
                action: 'delete',
                userId: auth.userId,
                before: customer,
                after: data,
                reason,
                source: 'customers_delete',
            });

            return ctx.json({ data });
        },
    )
    .post(
        '/:id/restore',
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

            const customer = await getAuthorizedCustomer({
                id,
                userId: auth.userId,
                deleted: 'only',
            });

            if (!customer) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            if (customer.isOwnFirm) {
                await unmarkOtherOwnFirmCustomers({
                    userId: auth.userId,
                    exceptId: id,
                    source: 'customers_restore_unmark_own_firm',
                });
            }

            const reason = await readLifecycleReason(ctx);
            const [data] = await db
                .update(customers)
                .set(
                    createCustomerRestorePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(customers.id, id))
                .returning();

            await writeCustomerAuditEvent({
                action: 'restore',
                userId: auth.userId,
                before: customer,
                after: data,
                reason,
                source: 'customers_restore',
            });

            return ctx.json({ data });
        },
    );

export default app;
