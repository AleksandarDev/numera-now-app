import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetTransactions = () => {
    const searchParams = useSearchParams();
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const accountId = searchParams.get('accountId') ?? undefined;

    const query = useQuery({
        queryKey: ['transactions', { from, to, accountId }],
        queryFn: async () => {
            const response = await client.api.transactions.$get({
                query: {
                    from,
                    to,
                    accountId,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch transactions.');

            const { data } = await response.json();

            const converted = data.map((transaction) => ({
                ...transaction,
                amount: convertAmountFromMiliunits(transaction.amount),
            }));

            // Group splits so parent is followed by its children
            const childrenByGroup = new Map<string, typeof converted>();
            for (const tx of converted) {
                if (tx.splitGroupId && tx.splitType === 'child') {
                    const list = childrenByGroup.get(tx.splitGroupId) ?? [];
                    list.push(tx);
                    childrenByGroup.set(tx.splitGroupId, list);
                }
            }

            const ordered: typeof converted = [];
            const seen = new Set<string>();

            for (const tx of converted) {
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
            for (const tx of converted) {
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
