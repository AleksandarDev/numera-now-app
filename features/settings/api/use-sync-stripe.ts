import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.stripe.sync)['$post']>;

export const useSyncStripe = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.stripe.sync.$post();

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error || 'Failed to sync with Stripe',
                );
            }

            return response.json();
        },
        onSuccess: (data) => {
            if ('data' in data) {
                const { created, total } = data.data;
                if (created > 0) {
                    toast.success(
                        `Synced ${created} new transaction${created !== 1 ? 's' : ''} from Stripe`,
                    );
                } else if (total === 0) {
                    toast.info('No new payments found since last sync');
                } else {
                    toast.info(
                        `All ${total} payment${total !== 1 ? 's' : ''} already synced`,
                    );
                }
            }
            queryClient.invalidateQueries({ queryKey: ['stripe-settings'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to sync with Stripe');
        },
    });

    return mutation;
};
