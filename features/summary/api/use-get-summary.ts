import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetSummary = () => {
    const [{ from, to, accountId }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
        accountId: parseAsString,
    });
    const queryFrom = from ?? '';
    const queryTo = to ?? '';
    const queryAccountId = accountId ?? '';

    const query = useQuery({
        queryKey: [
            'summary',
            { from: queryFrom, to: queryTo, accountId: queryAccountId },
        ],
        queryFn: async () => {
            const response = await client.api.summary.$get({
                query: {
                    from: queryFrom,
                    to: queryTo,
                    accountId: queryAccountId,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch summary.');

            const { data } = await response.json();

            return {
                ...data,
                incomeAmount: convertAmountFromMiliunits(data.incomeAmount),
                expensesAmount: convertAmountFromMiliunits(data.expensesAmount),
                remainingAmount: convertAmountFromMiliunits(
                    data.remainingAmount,
                ),
                tags: data.tags.map((tag) => ({
                    ...tag,
                    value: convertAmountFromMiliunits(tag.value),
                })),
                days: data.days.map((day) => ({
                    ...day,
                    income: convertAmountFromMiliunits(day.income),
                    expenses: convertAmountFromMiliunits(day.expenses),
                })),
            };
        },
    });

    return query;
};
