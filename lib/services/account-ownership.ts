import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/drizzle';
import { accounts } from '@/db/schema';
import {
    type AccountId,
    getDistinctAccountIds,
    getMissingAccountIds,
} from '@/lib/account-ownership';

export const getOwnedAccountReferences = async ({
    accountIds,
    userId,
}: {
    accountIds: readonly AccountId[];
    userId: string;
}) => {
    const requestedAccountIds = getDistinctAccountIds(accountIds);

    if (requestedAccountIds.length === 0) {
        return {
            accountMap: new Map<string, typeof accounts.$inferSelect>(),
            missingAccountIds: [] as string[],
        };
    }

    const ownedAccounts = await db
        .select()
        .from(accounts)
        .where(
            and(
                inArray(accounts.id, requestedAccountIds),
                eq(accounts.userId, userId),
            ),
        );
    const accountMap = new Map<string, typeof accounts.$inferSelect>(
        ownedAccounts.map((account) => [account.id, account] as const),
    );

    return {
        accountMap,
        missingAccountIds: getMissingAccountIds(
            requestedAccountIds,
            ownedAccounts.map((account) => account.id),
        ),
    };
};
