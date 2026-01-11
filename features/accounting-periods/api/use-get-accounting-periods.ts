import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export const useGetAccountingPeriods = () => {
    const query = useQuery({
        queryKey: ['accounting-periods'],
        queryFn: async () => {
            const response = await client.api['accounting-periods'].$get();

            if (!response.ok) {
                throw new Error('Failed to fetch accounting periods');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
