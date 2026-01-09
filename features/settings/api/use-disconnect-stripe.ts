import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useDisconnectStripe = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<{ success: boolean }, Error>({
        mutationFn: async () => {
            const response = await client.api.stripe.$delete();
            if (!response.ok) {
                throw new Error('Failed to disconnect Stripe.');
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Stripe disconnected.');
            queryClient.invalidateQueries({ queryKey: ['stripe-settings'] });
        },
        onError: () => {
            toast.error('Failed to disconnect Stripe.');
        },
    });

    return mutation;
};
