import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export type RevertCustomerAuditEventInput = {
    customerId: string;
    auditEventId: string;
    reason?: string;
};

export const useRevertCustomerAuditEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            customerId,
            auditEventId,
            reason,
        }: RevertCustomerAuditEventInput) => {
            const response = await client.api.customers[':id'].revert.$post({
                param: { id: customerId },
                json: {
                    auditEventId,
                    reason,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const conflicts =
                    (errorData as { conflicts?: string[] } | null)?.conflicts ??
                    [];
                const conflictText =
                    conflicts.length > 0 ? ` (${conflicts.join(', ')})` : '';
                throw new Error(
                    `${
                        (errorData as { error?: string } | null)?.error ??
                        'Failed to revert customer change.'
                    }${conflictText}`,
                );
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success('Customer change reverted.');
            queryClient.invalidateQueries({ queryKey: ['audit-events'] });
            queryClient.invalidateQueries({
                queryKey: ['customer', { id: variables.customerId }],
            });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({
                queryKey: [
                    'customer-ibans',
                    { customerId: variables.customerId },
                ],
            });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
