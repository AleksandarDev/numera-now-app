export type AccountId = string | null | undefined;

export const getDistinctAccountIds = (accountIds: readonly AccountId[]) => [
    ...new Set(
        accountIds.filter(
            (accountId): accountId is string =>
                typeof accountId === 'string' && accountId.length > 0,
        ),
    ),
];

export const getMissingAccountIds = (
    requestedAccountIds: readonly string[],
    ownedAccountIds: readonly string[],
) => {
    const ownedAccountIdSet = new Set(ownedAccountIds);
    return requestedAccountIds.filter(
        (accountId) => !ownedAccountIdSet.has(accountId),
    );
};
