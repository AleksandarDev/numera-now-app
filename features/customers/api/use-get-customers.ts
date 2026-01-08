import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetCustomers = (search?: string) => {
    const query = useQuery({
        queryKey: ['customers', { search }],
        queryFn: async () => {
            const response = await client.api.customers.$get({
                query: { search: search || '' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
