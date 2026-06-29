import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetDeletedDocuments = () =>
    useQuery({
        queryKey: ['all-documents', { deleted: 'only' }],
        queryFn: async () => {
            const response = await client.api.documents.$get({
                query: {
                    documentTypeId: undefined,
                    from: undefined,
                    to: undefined,
                    unattached: undefined,
                    deleted: 'only',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch deleted documents.');
            }

            const { data } = await response.json();
            return data;
        },
    });
