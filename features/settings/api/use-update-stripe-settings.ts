import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.stripe.$patch>;
type RequestType = InferRequestType<typeof client.api.stripe.$patch>['json'];

export const useUpdateStripeSettings = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.stripe.$patch({ json });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    (error as { error?: string }).error ||
                        'Failed to update Stripe settings.',
                );
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Stripe settings updated.');
            queryClient.invalidateQueries({ queryKey: ['stripe-settings'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update Stripe settings.');
        },
    });

    return mutation;
};
