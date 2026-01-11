import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetBankingSettings = () => {
    const query = useQuery({
        queryKey: ['banking-settings'],
        queryFn: async () => {
            const response = await client.api.banking.$get();

            if (!response.ok) {
                throw new Error('Failed to fetch bank integration settings.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
