import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';

import { client } from '@/lib/hono';

export type CustomerHistoryEvent = InferResponseType<
    (typeof client.api.customers)[':id']['history']['$get'],
    200
>['data'][0];

export const useGetCustomerHistory = (customerId?: string | null) =>
    useQuery({
        enabled: Boolean(customerId),
        queryKey: ['audit-events', { resourceType: 'customer', customerId }],
        queryFn: async () => {
            if (!customerId) {
                throw new Error('Customer ID is required.');
            }

            const response = await client.api.customers[':id'].history.$get({
                param: { id: customerId },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch customer history.');
            }

            const { data } = await response.json();
            return data;
        },
    });
