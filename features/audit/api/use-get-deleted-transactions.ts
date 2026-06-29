import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetDeletedTransactions = () =>
    useQuery({
        queryKey: ['transactions', { deleted: 'only' }],
        queryFn: async () => {
            const response = await client.api.transactions.$get({
                query: {
                    from: '1970-01-01',
                    to: '2999-12-31',
                    accountId: undefined,
                    payeeCustomerId: undefined,
                    deleted: 'only',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch deleted transactions.');
            }

            const { data } = await response.json();
            return data.map((transaction) => ({
                ...transaction,
                amount: convertAmountFromMiliunits(transaction.amount),
            }));
        },
    });
