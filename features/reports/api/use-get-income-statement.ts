import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetIncomeStatement = () => {
    const [{ from, to }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
    });
    const queryFrom = from ?? '';
    const queryTo = to ?? '';

    const query = useQuery({
        queryKey: ['income-statement', { from: queryFrom, to: queryTo }],
        queryFn: async () => {
            const response = await client.api.reports[
                'income-statement'
            ].$get({
                query: {
                    from: queryFrom,
                    to: queryTo,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch income statement.');

            const { data } = await response.json();

            return {
                ...data,
                incomeAccounts: data.incomeAccounts.map((account) => ({
                    ...account,
                    balance: convertAmountFromMiliunits(account.balance),
                })),
                expenseAccounts: data.expenseAccounts.map((account) => ({
                    ...account,
                    balance: convertAmountFromMiliunits(account.balance),
                })),
                totalIncome: convertAmountFromMiliunits(data.totalIncome),
                totalExpenses: convertAmountFromMiliunits(data.totalExpenses),
                netIncome: convertAmountFromMiliunits(data.netIncome),
            };
        },
    });

    return query;
};
