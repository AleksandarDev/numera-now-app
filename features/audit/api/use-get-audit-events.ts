import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';

import { client } from '@/lib/hono';

export type AuditEventFilters = {
    resourceType?: string;
    resourceId?: string;
    actorUserId?: string;
    actorType?: 'user' | 'system' | 'integration';
    action?: string;
    from?: string;
    to?: string;
    source?: string;
    limit?: number;
};

export type AuditEvent = InferResponseType<
    (typeof client.api)['audit-events']['$get'],
    200
>['data'][0];

export const useGetAuditEvents = (filters?: AuditEventFilters) =>
    useQuery({
        queryKey: ['audit-events', filters],
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const response = await client.api['audit-events'].$get({
                query: {
                    resourceType: filters?.resourceType,
                    resourceId: filters?.resourceId,
                    actorUserId: filters?.actorUserId,
                    actorType: filters?.actorType,
                    action: filters?.action,
                    from: filters?.from,
                    to: filters?.to,
                    source: filters?.source,
                    limit: filters?.limit?.toString(),
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audit events.');
            }

            const { data } = await response.json();
            return data;
        },
    });
