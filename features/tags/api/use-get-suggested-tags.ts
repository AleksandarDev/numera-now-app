import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetSuggestedTags = (customerId?: string) => {
    const query = useQuery({
        enabled: !!customerId,
        queryKey: ['suggested-tags', { customerId }],
        queryFn: async () => {
            if (!customerId) throw new Error('Customer ID is required');

            const response = await client.api.transactions[
                'suggested-tags'
            ].$get({
                query: { customerId },
            });

            if (!response.ok)
                throw new Error('Failed to fetch suggested tags.');

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
