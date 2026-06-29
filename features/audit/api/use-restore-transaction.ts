import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useRestoreTransaction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await client.api.transactions[':id'].restore.$post(
                {
                    param: { id },
                },
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    (errorData as { error?: string } | null)?.error ??
                        'Failed to restore transaction.',
                );
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Transaction restored.');
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['audit-events'] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
