import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetTag = (id?: string) => {
    const query = useQuery({
        enabled: !!id,
        queryKey: ['tag', { id }],
        queryFn: async () => {
            const response = await client.api.tags[':id'].$get({
                param: { id },
            });

            if (!response.ok) throw new Error('Failed to fetch tag.');

            const { data } = await response.json();

            return data;
        },
    });

    return query;
};
