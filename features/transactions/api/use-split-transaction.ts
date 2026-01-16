import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.transactions)[':id']['split']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api.transactions)[':id']['split']['$post']
>['json'];

export const useSplitTransaction = (id?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            if (!id) {
                throw new Error('Transaction ID is required');
            }
            const response = await client.api.transactions[':id'].split.$post({
                param: { id },
                json,
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage =
                    (errorData as { error?: string })?.error ||
                    'Failed to split transaction.';
                console.error('[useSplitTransaction] Error:', {
                    status: response.status,
                    errorData,
                });
                throw new Error(errorMessage);
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Transaction split successfully.');
            queryClient.invalidateQueries({
                queryKey: ['transaction', { id }],
            });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({
                queryKey: ['summary'],
            });
        },
        onError: () => {
            toast.error('Failed to split transaction.');
        },
    });

    return mutation;
};
