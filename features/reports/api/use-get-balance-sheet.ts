import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetBalanceSheet = () => {
    const [{ asOf }] = useQueryStates({
        asOf: parseAsString,
    });
    const queryAsOf = asOf ?? '';

    const query = useQuery({
        queryKey: ['balance-sheet', { asOf: queryAsOf }],
        queryFn: async () => {
            const response = await client.api.reports['balance-sheet'].$get({
                query: {
                    asOf: queryAsOf,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch balance sheet.');

            const { data } = await response.json();

            return {
                ...data,
                assetAccounts: data.assetAccounts.map((account) => ({
                    ...account,
                    balance: convertAmountFromMiliunits(account.balance),
                })),
                liabilityAccounts: data.liabilityAccounts.map((account) => ({
                    ...account,
                    balance: convertAmountFromMiliunits(account.balance),
                })),
                equityAccounts: data.equityAccounts.map((account) => ({
                    ...account,
                    balance: convertAmountFromMiliunits(account.balance),
                })),
                totalAssets: convertAmountFromMiliunits(data.totalAssets),
                totalLiabilities: convertAmountFromMiliunits(
                    data.totalLiabilities,
                ),
                totalEquity: convertAmountFromMiliunits(data.totalEquity),
                liabilitiesAndEquity: convertAmountFromMiliunits(
                    data.liabilitiesAndEquity,
                ),
                difference: convertAmountFromMiliunits(data.difference),
            };
        },
    });

    return query;
};
