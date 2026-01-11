import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useDisconnectBanking = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<unknown, Error>({
        mutationFn: async () => {
            const response = await client.api.banking.$delete();

            if (!response.ok) {
                throw new Error('Failed to disconnect Enable Banking.');
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('Enable Banking disconnected.');
            queryClient.invalidateQueries({ queryKey: ['banking-settings'] });
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        },
        onError: () => {
            toast.error('Failed to disconnect Enable Banking.');
        },
    });

    return mutation;
};
