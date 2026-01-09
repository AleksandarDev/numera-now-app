import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export const useGetUnattachedDocuments = () => {
    const query = useQuery({
        queryKey: ['unattached-documents'],
        queryFn: async () => {
            const response = await client.api.documents.$get({
                query: {
                    unattached: 'true',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch unattached documents.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
