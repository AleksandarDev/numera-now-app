import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export type SuggestedCustomer = {
    customerId: string;
};

type SuggestedCustomersOptions = {
    enabled?: boolean;
};

export const useGetSuggestedCustomers = (
    query?: string,
    options?: SuggestedCustomersOptions,
) => {
    const normalizedQuery = query?.trim() ?? '';

    const suggestedQuery = useQuery({
        enabled: normalizedQuery.length > 0 && (options?.enabled ?? true),
        queryKey: [
            'transactions',
            'suggested-customers',
            { query: normalizedQuery },
        ],
        queryFn: async () => {
            if (!normalizedQuery) {
                throw new Error('Query is required');
            }

            const response = await client.api.transactions[
                'suggested-customers'
            ].$get({
                query: { query: normalizedQuery },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch suggested customers.');
            }

            const { data } = await response.json();
            return data as SuggestedCustomer[];
        },
    });

    return suggestedQuery;
};
