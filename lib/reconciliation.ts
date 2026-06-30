import { aliasedTable, and, count, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import {
    accounts,
    documents,
    documentTransactionLinks,
    settings,
    transactions,
} from '@/db/schema';

export type ReconciliationCondition =
    | 'hasReceipt'
    | 'isReviewed'
    | 'isApproved';

const hasTransactionAccess = async (
    transactionId: string,
    userId: string,
): Promise<boolean> => {
    const creditAccounts = aliasedTable(accounts, 'creditAccounts');
    const debitAccounts = aliasedTable(accounts, 'debitAccounts');
    const [transaction] = await db
        .select({ id: transactions.id })
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
                eq(transactions.id, transactionId),
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
                ),
                isNull(transactions.deletedAt),
            ),
        );

    return Boolean(transaction);
};

const getTransactionDocumentTargetIds = async (
    transactionId: string,
    userId: string,
) => {
    const [transaction] = await db
        .select({
            id: transactions.id,
            splitGroupId: transactions.splitGroupId,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.id, transactionId),
                isNull(transactions.deletedAt),
            ),
        );

    if (!transaction?.splitGroupId) {
        return [transactionId];
    }

    const creditAccounts = aliasedTable(accounts, 'documentCreditAccounts');
    const debitAccounts = aliasedTable(accounts, 'documentDebitAccounts');

    const splitGroupMembers = await db
        .select({ id: transactions.id })
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
                eq(transactions.splitGroupId, transaction.splitGroupId),
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
                ),
                isNull(transactions.deletedAt),
            ),
        );

    return splitGroupMembers.length > 0
        ? splitGroupMembers.map((member) => member.id)
        : [transaction.id];
};

const hasReceipt = async (transactionId: string, userId: string) => {
    const documentTargetIds = await getTransactionDocumentTargetIds(
        transactionId,
        userId,
    );
    const [docCount] = await db
        .select({ count: count() })
        .from(documents)
        .where(
            and(
                inArray(documents.transactionId, documentTargetIds),
                eq(documents.isDeleted, false),
            ),
        );

    if (docCount.count > 0) return true;

    const [linkedDocCount] = await db
        .select({ count: count() })
        .from(documentTransactionLinks)
        .innerJoin(
            documents,
            eq(documentTransactionLinks.documentId, documents.id),
        )
        .where(
            and(
                inArray(
                    documentTransactionLinks.transactionId,
                    documentTargetIds,
                ),
                eq(documents.isDeleted, false),
            ),
        );

    return linkedDocCount.count > 0;
};

/**
 * Check if a transaction meets the reconciliation conditions
 */
export async function isTransactionReconciled(
    transactionId: string,
    userId: string,
): Promise<boolean> {
    // Get user settings
    const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId));

    if (!userSettings) return false;

    const conditions: ReconciliationCondition[] = JSON.parse(
        userSettings.reconciliationConditions || '[]',
    );

    // If no conditions are defined, transaction is considered reconcilable
    if (conditions.length === 0) return true;

    const canAccess = await hasTransactionAccess(transactionId, userId);
    if (!canAccess) return false;

    // Check each condition
    for (const condition of conditions) {
        switch (condition) {
            case 'hasReceipt': {
                if (!(await hasReceipt(transactionId, userId))) return false;
                break;
            }

            case 'isReviewed': {
                // This would require a field on transactions table for review status
                // For now, we'll skip this check
                break;
            }

            case 'isApproved': {
                // This would require a field on transactions table for approval status
                // For now, we'll skip this check
                break;
            }
        }
    }

    return true;
}

/**
 * Check if all child transactions in a split group are reconciled
 */
export async function areSplitTransactionsReconciled(
    splitGroupId: string,
    userId: string,
): Promise<boolean> {
    // Get all child transactions in the group
    const childTransactions = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
            and(
                eq(transactions.splitGroupId, splitGroupId),
                eq(transactions.splitType, 'child'),
                isNull(transactions.deletedAt),
            ),
        );

    // Check if all are reconciled
    for (const tx of childTransactions) {
        const reconciled = await isTransactionReconciled(tx.id, userId);
        if (!reconciled) return false;
    }

    return true;
}

/**
 * Get reconciliation status details for a transaction
 */
export async function getReconciliationStatus(
    transactionId: string,
    userId: string,
): Promise<{
    isReconciled: boolean;
    conditions: {
        name: ReconciliationCondition;
        met: boolean;
    }[];
}> {
    const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId));

    if (!userSettings) {
        return {
            isReconciled: false,
            conditions: [],
        };
    }

    const conditionsList: ReconciliationCondition[] = JSON.parse(
        userSettings.reconciliationConditions || '[]',
    );

    // If no conditions are defined, transaction is considered reconcilable
    if (conditionsList.length === 0) {
        return {
            isReconciled: true,
            conditions: [],
        };
    }

    const canAccess = await hasTransactionAccess(transactionId, userId);

    if (!canAccess) {
        return {
            isReconciled: false,
            conditions: [],
        };
    }

    const conditionStatus = await Promise.all(
        conditionsList.map(async (condition) => {
            let met = false;

            switch (condition) {
                case 'hasReceipt': {
                    met = await hasReceipt(transactionId, userId);
                    break;
                }

                case 'isReviewed': {
                    // Would need a reviewed field on transactions
                    met = false;
                    break;
                }

                case 'isApproved': {
                    // Would need an approved field on transactions
                    met = false;
                    break;
                }
            }

            return { name: condition, met };
        }),
    );

    const isReconciled = conditionStatus.every((c) => c.met);

    return {
        isReconciled,
        conditions: conditionStatus,
    };
}
