import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.banking.test)['$post']
>;

export const useTestBankingConnection = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.banking.test.$post();

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error ||
                        'Failed to test Enable Banking connection.',
                );
            }

            return response.json();
        },
        onSuccess: (data) => {
            if ('data' in data && data.data.connected) {
                toast.success(
                    data.data.message ||
                        'Enable Banking connected successfully.',
                );
            }
            queryClient.invalidateQueries({ queryKey: ['banking-settings'] });
        },
        onError: (error) => {
            toast.error(
                error.message || 'Failed to test Enable Banking connection.',
            );
        },
    });

    return mutation;
};
