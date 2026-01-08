import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export type SuggestedAccount = {
    accountId: string;
    usageCount: number;
    lastUsed: string | null;
};

type SuggestedAccountsResponse = {
    credit: SuggestedAccount[];
    debit: SuggestedAccount[];
};

export const useGetSuggestedAccounts = (customerId?: string) => {
    const query = useQuery({
        enabled: !!customerId,
        queryKey: ['transactions', 'suggested-accounts', { customerId }],
        queryFn: async () => {
            if (!customerId) {
                throw new Error('Customer ID is required');
            }

            const response = await client.api.transactions[
                'suggested-accounts'
            ].$get({
                query: { customerId },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch suggested accounts.');
            }

            const { data } = await response.json();
            return data as SuggestedAccountsResponse;
        },
    });

    return query;
};
