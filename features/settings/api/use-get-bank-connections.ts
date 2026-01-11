import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetBankConnections = () => {
    const query = useQuery({
        queryKey: ['bank-connections'],
        queryFn: async () => {
            const response = await client.api.banking.connections.$get();

            if (!response.ok) {
                throw new Error('Failed to fetch bank connections.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
