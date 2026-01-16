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
            const response = await client.api.transactions[':id'].split.$post({
                param: { id: id || '' },
                json,
            });
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
