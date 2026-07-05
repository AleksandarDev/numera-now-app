import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export const useGetApiKeys = () => {
    const query = useQuery({
        queryKey: ['api-keys'],
        queryFn: async () => {
            const response = await client.api['api-keys'].$get();

            if (!response.ok) {
                throw new Error('Failed to fetch API keys.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
