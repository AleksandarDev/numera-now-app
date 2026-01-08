import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetTransactions = () => {
    const [{ from, to, accountId }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
        accountId: parseAsString,
    });
    const queryFrom = from ?? undefined;
    const queryTo = to ?? undefined;
    const queryAccountId = accountId ?? undefined;

    const query = useQuery({
        queryKey: [
            'transactions',
            { from: queryFrom, to: queryTo, accountId: queryAccountId },
        ],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const response = await client.api.transactions.$get({
                query: {
                    from: queryFrom,
                    to: queryTo,
                    accountId: queryAccountId,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch transactions.');

            const { data } = await response.json();

            const converted = data.map((transaction) => ({
                ...transaction,
                amount: convertAmountFromMiliunits(transaction.amount),
            }));

            const sortedByDateDesc = [...converted].sort((a, b) => {
                const aTime = new Date(a.date).getTime();
                const bTime = new Date(b.date).getTime();
                if (aTime !== bTime) return bTime - aTime;
                return a.id.localeCompare(b.id);
            });

            // Group splits so parent is followed by its children
            const childrenByGroup = new Map<string, typeof converted>();
            for (const tx of sortedByDateDesc) {
                if (tx.splitGroupId && tx.splitType === 'child') {
                    const list = childrenByGroup.get(tx.splitGroupId) ?? [];
                    list.push(tx);
                    childrenByGroup.set(tx.splitGroupId, list);
                }
            }

            const ordered: typeof converted = [];
            const seen = new Set<string>();

            for (const tx of sortedByDateDesc) {
                if (seen.has(tx.id)) continue;

                if (tx.splitGroupId && tx.splitType === 'parent') {
                    ordered.push(tx);
                    seen.add(tx.id);
                    const kids = childrenByGroup.get(tx.splitGroupId) ?? [];
                    for (const child of kids) {
                        if (!seen.has(child.id)) {
                            ordered.push(child);
                            seen.add(child.id);
                        }
                    }
                } else if (!tx.splitGroupId || tx.splitType !== 'child') {
                    ordered.push(tx);
                    seen.add(tx.id);
                }
            }

            // Any orphan children (missing parent) get appended at end
            for (const tx of sortedByDateDesc) {
                if (!seen.has(tx.id)) {
                    ordered.push(tx);
                    seen.add(tx.id);
                }
            }

            return ordered;
        },
    });

    return query;
};
