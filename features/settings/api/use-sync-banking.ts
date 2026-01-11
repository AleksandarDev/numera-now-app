import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.banking.sync)['$post']
>;

export const useSyncBanking = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.banking.sync.$post();

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error || 'Failed to sync with banks.',
                );
            }

            return response.json();
        },
        onSuccess: (data) => {
            if ('data' in data) {
                const { created, total } = data.data;
                const errors =
                    'errors' in data.data ? data.data.errors : undefined;
                if (errors && errors.length > 0) {
                    toast.warning(
                        `Synced ${created} new transaction${created !== 1 ? 's' : ''} with some errors`,
                    );
                } else if (created > 0) {
                    toast.success(
                        `Synced ${created} new transaction${created !== 1 ? 's' : ''} from bank accounts`,
                    );
                } else if (total === 0) {
                    toast.info('No new transactions found since last sync');
                } else {
                    toast.info(
                        `All ${total} transaction${total !== 1 ? 's' : ''} already synced`,
                    );
                }
            }
            queryClient.invalidateQueries({ queryKey: ['banking-settings'] });
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to sync with banks.');
        },
    });

    return mutation;
};
