import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

export const useGetStripeSettings = () => {
    const query = useQuery({
        queryKey: ['stripe-settings'],
        queryFn: async () => {
            const response = await client.api.stripe.$get();

            if (!response.ok) {
                throw new Error('Failed to fetch Stripe settings.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
