import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetInstitutions = (country = 'HR') => {
    const query = useQuery({
        queryKey: ['institutions', country],
        queryFn: async () => {
            const response = await client.api.banking.institutions.$get({
                query: { country },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch institutions.');
            }

            const { data } = await response.json();
            return data;
        },
        enabled: false, // Only fetch when explicitly requested
    });

    return query;
};
