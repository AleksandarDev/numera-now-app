export const TRANSACTION_SPLIT_LIFECYCLE_POLICY =
    'Transaction delete, restore, and purge actions apply to every row in the split group when the selected transaction belongs to a split group.';

export const createTransactionSoftDeletePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: {
    userId: string;
    reason?: string | null;
    now?: Date;
}) => ({
    deletedAt: now,
    deletedBy: userId,
    deleteReason: reason,
    restoredAt: null,
    restoredBy: null,
    restoreReason: null,
});

export const createTransactionRestorePatch = ({
    userId,
    reason = null,
    now = new Date(),
}: {
    userId: string;
    reason?: string | null;
    now?: Date;
}) => ({
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    restoredAt: now,
    restoredBy: userId,
    restoreReason: reason,
});

export const expandTransactionLifecycleTargetIds = <
    Transaction extends { id: string; splitGroupId?: string | null },
>(
    selectedIds: string[],
    authorizedTransactions: Transaction[],
) => {
    const selectedIdSet = new Set(selectedIds);
    const selectedSplitGroupIds = new Set(
        authorizedTransactions
            .filter(
                (transaction) =>
                    selectedIdSet.has(transaction.id) &&
                    transaction.splitGroupId,
            )
            .map((transaction) => transaction.splitGroupId as string),
    );

    return authorizedTransactions
        .filter(
            (transaction) =>
                selectedIdSet.has(transaction.id) ||
                (transaction.splitGroupId
                    ? selectedSplitGroupIds.has(transaction.splitGroupId)
                    : false),
        )
        .map((transaction) => transaction.id);
};
