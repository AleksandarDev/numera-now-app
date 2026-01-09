import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetOpenFinancesSettings = () => {
    const query = useQuery({
        queryKey: ['open-finances-settings'],
        queryFn: async () => {
            const response = await client.api['open-finances'].$get();

            if (!response.ok) {
                throw new Error('Failed to fetch open finances settings');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
