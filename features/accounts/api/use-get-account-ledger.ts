import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetAccountLedger = (id?: string) => {
    const [{ from, to }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
    });
    const queryFrom = from ?? undefined;
    const queryTo = to ?? undefined;

    const query = useQuery({
        enabled: !!id,
        queryKey: ['account-ledger', { id, from: queryFrom, to: queryTo }],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const response = await client.api.accounts[':id'].ledger.$get({
                param: { id },
                query: {
                    from: queryFrom,
                    to: queryTo,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch account ledger.');
            }

            const { data } = await response.json();

            // Convert amounts from miliunits
            const convertedEntries = data.entries.map((entry) => ({
                ...entry,
                amount: convertAmountFromMiliunits(entry.amount),
            }));

            return {
                ...data,
                account: {
                    ...data.account,
                    openingBalance: convertAmountFromMiliunits(
                        data.account.openingBalance,
                    ),
                },
                entries: convertedEntries,
            };
        },
    });

    return query;
};
