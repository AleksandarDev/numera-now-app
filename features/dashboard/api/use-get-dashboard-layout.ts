import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetDashboardLayout = () => {
    const query = useQuery({
        queryKey: ['dashboard-layout'],
        queryFn: async () => {
            const response = await client.api.dashboard.$get();

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard layout');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
