import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetCustomers = (search?: string) => {
    const query = useQuery({
        queryKey: ['customers', { search }],
        queryFn: async () => {
            const response = await client.api.customers.$get({
                query: { search: search || '' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }

            const { data } = await response.json();
            return [...data].sort((a, b) => {
                const aName = a.name ?? '';
                const bName = b.name ?? '';
                const nameCompare = aName.localeCompare(bName, undefined, {
                    sensitivity: 'base',
                });
                if (nameCompare !== 0) return nameCompare;
                return a.id.localeCompare(b.id);
            });
        },
    });

    return query;
};
