import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.transactions)[':id']['unreconcile']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api.transactions)[':id']['unreconcile']['$post']
>['json'];

export const useUnreconcileTransaction = (id?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            if (!id) {
                throw new Error('Transaction ID is required');
            }
            const response = await client.api.transactions[':id'][
                'unreconcile'
            ].$post({
                json,
                param: { id },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage =
                    (errorData as { error?: string })?.error ||
                    'Failed to unreconcile transaction.';
                console.error('[useUnreconcileTransaction] Error:', {
                    status: response.status,
                    errorData,
                });
                throw new Error(errorMessage);
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Transaction unreconciled.');
            queryClient.invalidateQueries({
                queryKey: ['transaction', { id }],
            });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({
                queryKey: ['transaction-status-history', { id }],
            });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to unreconcile transaction.');
        },
    });

    return mutation;
};
