import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

interface UseGetAllDocumentsParams {
    documentTypeId?: string;
    from?: string;
    to?: string;
    unattached?: boolean;
}

export const useGetAllDocuments = (params?: UseGetAllDocumentsParams) => {
    const query = useQuery({
        queryKey: ['all-documents', params],
        queryFn: async () => {
            const response = await client.api.documents.$get({
                query: {
                    documentTypeId: params?.documentTypeId,
                    from: params?.from,
                    to: params?.to,
                    unattached: params?.unattached ? 'true' : undefined,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch documents.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
