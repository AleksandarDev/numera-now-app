import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useRestoreDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await client.api.documents[':id'].restore.$post({
                param: { id },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    (errorData as { error?: string } | null)?.error ??
                        'Failed to restore document.',
                );
            }

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Document restored.');
            queryClient.invalidateQueries({ queryKey: ['all-documents'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['audit-events'] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
