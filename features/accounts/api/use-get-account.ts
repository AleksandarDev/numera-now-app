import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

type GetAccountOptions = {
    enabled?: boolean;
};

export const useGetAccount = (id?: string, options?: GetAccountOptions) => {
    const query = useQuery({
        enabled: !!id && (options?.enabled ?? true),
        queryKey: ['account', { id }],
        queryFn: async () => {
            const response = await client.api.accounts[':id'].$get({
                param: { id },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch account');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
