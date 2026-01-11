import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useDeleteBankConnection = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<unknown, Error, { connectionId: string }>({
        mutationFn: async ({ connectionId }) => {
            const response = await client.api.banking.connections[
                ':connectionId'
            ].$delete({
                param: { connectionId },
            });

            if (!response.ok) {
                throw new Error('Failed to delete bank connection.');
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('Bank connection removed.');
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        },
        onError: () => {
            toast.error('Failed to delete bank connection.');
        },
    });

    return mutation;
};
