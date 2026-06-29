import { UTCDate } from '@date-fns/utc';
import {
    aliasedTable,
    and,
    eq,
    inArray,
    isNotNull,
    isNull,
    ne,
    or,
} from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { accounts, customers, documents, transactions } from '@/db/schema';
import { validateDateNotInClosedPeriod } from '@/lib/accounting-periods';
import { type AuditAction, writeAuditEvent } from '@/lib/audit';
import { deleteDocument as deleteDocumentBlob } from '@/lib/azure-storage';
import {
    createCustomerRestorePatch,
    createCustomerSoftDeletePatch,
} from '@/lib/customer-lifecycle';
import {
    createDocumentRestorePatch,
    createDocumentSoftDeletePatch,
} from '@/lib/document-lifecycle';
import {
    createTransactionRestorePatch,
    createTransactionSoftDeletePatch,
    expandTransactionLifecycleTargetIds,
    TRANSACTION_SPLIT_LIFECYCLE_POLICY,
} from '@/lib/transaction-lifecycle';

type MutationSource =
    | 'mcp_transactions_delete'
    | 'mcp_transactions_restore'
    | 'mcp_transactions_purge'
    | 'mcp_customers_delete'
    | 'mcp_customers_restore'
    | 'mcp_documents_delete'
    | 'mcp_documents_restore'
    | 'mcp_documents_purge';

type MutationResult<T> =
    | {
          ok: true;
          data: T;
      }
    | {
          ok: false;
          status: 400 | 403 | 404 | 500;
          error: string;
      };

type DeletedMode = 'include' | 'only';

const transactionDeletedFilter = (deleted?: DeletedMode) => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return isNotNull(transactions.deletedAt);
    }

    return isNull(transactions.deletedAt);
};

const transactionAccessFilter = (
    userId: string,
    creditAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
    debitAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
) =>
    or(
        eq(accounts.userId, userId),
        eq(creditAccounts.userId, userId),
        eq(debitAccounts.userId, userId),
        and(
            isNull(transactions.accountId),
            isNull(transactions.creditAccountId),
            isNull(transactions.debitAccountId),
            eq(transactions.statusChangedBy, userId),
        ),
        eq(transactions.deletedBy, userId),
    );

const getAuthorizedTransactionLifecycleRows = async ({
    ids,
    userId,
    deleted,
}: {
    ids: string[];
    userId: string;
    deleted?: DeletedMode;
}) => {
    if (ids.length === 0) {
        return [];
    }

    const uniqueIds = [...new Set(ids)];
    const creditAccounts = aliasedTable(accounts, 'creditAccounts');
    const debitAccounts = aliasedTable(accounts, 'debitAccounts');
    const selectedRows = await db
        .select({ transaction: transactions })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(
            creditAccounts,
            eq(transactions.creditAccountId, creditAccounts.id),
        )
        .leftJoin(
            debitAccounts,
            eq(transactions.debitAccountId, debitAccounts.id),
        )
        .where(
            and(
                inArray(transactions.id, uniqueIds),
                transactionAccessFilter(userId, creditAccounts, debitAccounts),
                transactionDeletedFilter(deleted),
            ),
        );

    const splitGroupIds = [
        ...new Set(
            selectedRows
                .map(({ transaction }) => transaction.splitGroupId)
                .filter(Boolean) as string[],
        ),
    ];

    if (splitGroupIds.length === 0) {
        return selectedRows.map(({ transaction }) => transaction);
    }

    const expandedRows = await db
        .select({ transaction: transactions })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(
            creditAccounts,
            eq(transactions.creditAccountId, creditAccounts.id),
        )
        .leftJoin(
            debitAccounts,
            eq(transactions.debitAccountId, debitAccounts.id),
        )
        .where(
            and(
                or(
                    inArray(transactions.id, uniqueIds),
                    inArray(transactions.splitGroupId, splitGroupIds),
                ),
                transactionAccessFilter(userId, creditAccounts, debitAccounts),
                transactionDeletedFilter(deleted),
            ),
        );

    const targetIds = new Set(
        expandTransactionLifecycleTargetIds(
            uniqueIds,
            expandedRows.map(({ transaction }) => transaction),
        ),
    );

    return expandedRows
        .map(({ transaction }) => transaction)
        .filter((transaction) => targetIds.has(transaction.id));
};

const writeTransactionLifecycleAuditEvents = async ({
    action,
    userId,
    beforeRows,
    afterRows,
    reason,
    source,
}: {
    action: 'delete' | 'restore' | 'purge';
    userId: string;
    beforeRows: (typeof transactions.$inferSelect)[];
    afterRows?: (typeof transactions.$inferSelect)[];
    reason?: string | null;
    source: MutationSource;
}) => {
    const afterById = new Map(afterRows?.map((row) => [row.id, row]) ?? []);

    for (const before of beforeRows) {
        await writeAuditEvent(db, {
            userId,
            actorUserId: userId,
            actorType: 'user',
            action,
            resourceType: 'transaction',
            resourceId: before.id,
            resourceLabel: before.payee,
            before,
            after: afterById.get(before.id) ?? null,
            sourceMetadata: {
                source,
                reason: reason ?? null,
                splitPolicy: TRANSACTION_SPLIT_LIFECYCLE_POLICY,
            },
        });
    }
};

const rejectClosedPeriodTransactions = async (
    rows: (typeof transactions.$inferSelect)[],
    userId: string,
    verb: string,
): Promise<MutationResult<never> | null> => {
    for (const transaction of rows) {
        const periodError = await validateDateNotInClosedPeriod(
            transaction.date,
            userId,
        );
        if (periodError) {
            return {
                ok: false,
                status: 400,
                error: `Cannot ${verb} transaction ${transaction.id}: ${periodError}`,
            };
        }
    }

    return null;
};

export const deleteTransactionForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<(typeof transactions.$inferSelect)[]>> => {
    const rows = await getAuthorizedTransactionLifecycleRows({
        ids: [id],
        userId,
    });

    if (rows.length === 0) {
        return { ok: false, status: 404, error: 'Transaction not found.' };
    }

    const periodRejection = await rejectClosedPeriodTransactions(
        rows,
        userId,
        'delete',
    );
    if (periodRejection) return periodRejection;

    const data = await db
        .update(transactions)
        .set(
            createTransactionSoftDeletePatch({
                userId,
                reason: reason ?? null,
                now: new UTCDate(),
            }),
        )
        .where(
            inArray(
                transactions.id,
                rows.map((row) => row.id),
            ),
        )
        .returning();

    await writeTransactionLifecycleAuditEvents({
        action: 'delete',
        userId,
        beforeRows: rows,
        afterRows: data,
        reason,
        source: 'mcp_transactions_delete',
    });

    return { ok: true, data };
};

export const restoreTransactionForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<(typeof transactions.$inferSelect)[]>> => {
    const rows = await getAuthorizedTransactionLifecycleRows({
        ids: [id],
        userId,
        deleted: 'only',
    });

    if (rows.length === 0) {
        return { ok: false, status: 404, error: 'Transaction not found.' };
    }

    const periodRejection = await rejectClosedPeriodTransactions(
        rows,
        userId,
        'restore',
    );
    if (periodRejection) return periodRejection;

    const data = await db
        .update(transactions)
        .set(
            createTransactionRestorePatch({
                userId,
                reason: reason ?? null,
                now: new UTCDate(),
            }),
        )
        .where(
            inArray(
                transactions.id,
                rows.map((row) => row.id),
            ),
        )
        .returning();

    await writeTransactionLifecycleAuditEvents({
        action: 'restore',
        userId,
        beforeRows: rows,
        afterRows: data,
        reason,
        source: 'mcp_transactions_restore',
    });

    return { ok: true, data };
};

export const purgeTransactionForUser = async ({
    userId,
    id,
    reason,
    confirm,
}: {
    userId: string;
    id: string;
    reason?: string | null;
    confirm?: boolean;
}): Promise<MutationResult<(typeof transactions.$inferSelect)[]>> => {
    if (confirm !== true) {
        return {
            ok: false,
            status: 400,
            error: 'Permanent purge requires confirm: true.',
        };
    }

    const rows = await getAuthorizedTransactionLifecycleRows({
        ids: [id],
        userId,
        deleted: 'only',
    });

    if (rows.length === 0) {
        return { ok: false, status: 404, error: 'Transaction not found.' };
    }

    const data = await db
        .delete(transactions)
        .where(
            inArray(
                transactions.id,
                rows.map((row) => row.id),
            ),
        )
        .returning();

    await writeTransactionLifecycleAuditEvents({
        action: 'purge',
        userId,
        beforeRows: rows,
        afterRows: [],
        reason,
        source: 'mcp_transactions_purge',
    });

    return { ok: true, data };
};

const getAuthorizedDocument = async ({
    id,
    userId,
    deleted,
}: {
    id: string;
    userId: string;
    deleted?: DeletedMode;
}) => {
    const [document] = await db
        .select()
        .from(documents)
        .where(
            and(
                eq(documents.id, id),
                eq(documents.uploadedBy, userId),
                deleted === 'only'
                    ? eq(documents.isDeleted, true)
                    : eq(documents.isDeleted, false),
            ),
        );

    return document ?? null;
};

const writeDocumentAuditEvent = async ({
    action,
    userId,
    before,
    after,
    reason,
    source,
}: {
    action: AuditAction;
    userId: string;
    before?: typeof documents.$inferSelect | null;
    after?: typeof documents.$inferSelect | null;
    reason?: string | null;
    source: MutationSource;
}) => {
    const resource = after ?? before;
    if (!resource) return;

    await writeAuditEvent(db, {
        userId,
        actorUserId: userId,
        actorType: 'user',
        action,
        resourceType: 'document',
        resourceId: resource.id,
        resourceLabel: resource.fileName,
        before: before ?? null,
        after: after ?? null,
        sourceMetadata: {
            source,
            reason: reason ?? null,
        },
    });
};

export const deleteDocumentForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<typeof documents.$inferSelect>> => {
    const document = await getAuthorizedDocument({ id, userId });
    if (!document) {
        return { ok: false, status: 404, error: 'Document not found.' };
    }

    const [updatedDocument] = await db
        .update(documents)
        .set(createDocumentSoftDeletePatch({ userId, reason: reason ?? null }))
        .where(eq(documents.id, id))
        .returning();

    await writeDocumentAuditEvent({
        action: 'delete',
        userId,
        before: document,
        after: updatedDocument,
        reason,
        source: 'mcp_documents_delete',
    });

    return { ok: true, data: updatedDocument };
};

export const restoreDocumentForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<typeof documents.$inferSelect>> => {
    const document = await getAuthorizedDocument({
        id,
        userId,
        deleted: 'only',
    });
    if (!document) {
        return { ok: false, status: 404, error: 'Document not found.' };
    }

    const [updatedDocument] = await db
        .update(documents)
        .set(createDocumentRestorePatch({ userId, reason: reason ?? null }))
        .where(eq(documents.id, id))
        .returning();

    await writeDocumentAuditEvent({
        action: 'restore',
        userId,
        before: document,
        after: updatedDocument,
        reason,
        source: 'mcp_documents_restore',
    });

    return { ok: true, data: updatedDocument };
};

export const purgeDocumentForUser = async ({
    userId,
    id,
    reason,
    confirm,
}: {
    userId: string;
    id: string;
    reason?: string | null;
    confirm?: boolean;
}): Promise<MutationResult<typeof documents.$inferSelect>> => {
    if (confirm !== true) {
        return {
            ok: false,
            status: 400,
            error: 'Permanent purge requires confirm: true.',
        };
    }

    const document = await getAuthorizedDocument({
        id,
        userId,
        deleted: 'only',
    });
    if (!document) {
        return { ok: false, status: 404, error: 'Document not found.' };
    }

    await deleteDocumentBlob(document.storagePath);

    const [purgedDocument] = await db
        .delete(documents)
        .where(eq(documents.id, id))
        .returning();

    await writeDocumentAuditEvent({
        action: 'purge',
        userId,
        before: document,
        after: null,
        reason,
        source: 'mcp_documents_purge',
    });

    return { ok: true, data: purgedDocument };
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
                deleted === 'only'
                    ? eq(customers.isDeleted, true)
                    : eq(customers.isDeleted, false),
            ),
        );

    return customer ?? null;
};

const writeCustomerAuditEvent = async ({
    action,
    userId,
    before,
    after,
    reason,
    source,
}: {
    action: AuditAction;
    userId: string;
    before?: typeof customers.$inferSelect | null;
    after?: typeof customers.$inferSelect | null;
    reason?: string | null;
    source: MutationSource;
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
    });
};

const unmarkOtherOwnFirmCustomers = async ({
    userId,
    exceptId,
}: {
    userId: string;
    exceptId?: string;
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
            source: 'mcp_customers_restore',
        });
    }
};

export const deleteCustomerForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<typeof customers.$inferSelect>> => {
    const customer = await getAuthorizedCustomer({ id, userId });
    if (!customer) {
        return { ok: false, status: 404, error: 'Customer not found.' };
    }

    const [updatedCustomer] = await db
        .update(customers)
        .set(createCustomerSoftDeletePatch({ userId, reason: reason ?? null }))
        .where(eq(customers.id, id))
        .returning();

    await writeCustomerAuditEvent({
        action: 'delete',
        userId,
        before: customer,
        after: updatedCustomer,
        reason,
        source: 'mcp_customers_delete',
    });

    return { ok: true, data: updatedCustomer };
};

export const restoreCustomerForUser = async ({
    userId,
    id,
    reason,
}: {
    userId: string;
    id: string;
    reason?: string | null;
}): Promise<MutationResult<typeof customers.$inferSelect>> => {
    const customer = await getAuthorizedCustomer({
        id,
        userId,
        deleted: 'only',
    });
    if (!customer) {
        return { ok: false, status: 404, error: 'Customer not found.' };
    }

    if (customer.isOwnFirm) {
        await unmarkOtherOwnFirmCustomers({ userId, exceptId: id });
    }

    const [updatedCustomer] = await db
        .update(customers)
        .set(createCustomerRestorePatch({ userId, reason: reason ?? null }))
        .where(eq(customers.id, id))
        .returning();

    await writeCustomerAuditEvent({
        action: 'restore',
        userId,
        before: customer,
        after: updatedCustomer,
        reason,
        source: 'mcp_customers_restore',
    });

    return { ok: true, data: updatedCustomer };
};
