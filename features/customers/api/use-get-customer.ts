import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

type GetCustomerOptions = {
    enabled?: boolean;
};

export const useGetCustomer = (id?: string, options?: GetCustomerOptions) => {
    const query = useQuery({
        enabled: !!id && (options?.enabled ?? true),
        queryKey: ['customer', { id }],
        queryFn: async () => {
            const response = await client.api.customers[':id'].$get({
                param: { id },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch customer');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
