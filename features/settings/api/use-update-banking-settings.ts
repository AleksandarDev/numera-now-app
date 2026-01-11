import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.banking.$patch>;
type RequestType = InferRequestType<typeof client.api.banking.$patch>['json'];

export const useUpdateBankingSettings = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.banking.$patch({ json });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error ||
                        'Failed to update bank integration settings.',
                );
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('Bank integration settings updated.');
            queryClient.invalidateQueries({ queryKey: ['banking-settings'] });
        },
        onError: (error) => {
            toast.error(
                error.message || 'Failed to update bank integration settings.',
            );
        },
    });

    return mutation;
};
