import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetIncompleteCustomersCount = () => {
    const query = useQuery({
        queryKey: ['customers', 'incomplete-count'],
        queryFn: async () => {
            const response =
                await client.api.customers['incomplete-count'].$get();

            if (!response.ok) {
                throw new Error('Failed to fetch incomplete customers count');
            }

            const { count } = await response.json();
            return count;
        },
    });

    return query;
};
