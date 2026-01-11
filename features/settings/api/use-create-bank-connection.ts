import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.banking.connections)['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api.banking.connections)['$post']
>['json'];

export const useCreateBankConnection = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.banking.connections.$post({
                json,
            });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error || 'Failed to create bank connection.',
                );
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create bank connection.');
        },
    });

    return mutation;
};
