import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.customers)['bulk-delete']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api.customers)['bulk-delete']['$post']
>['json'];

export const useBulkDeleteCustomers = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.customers['bulk-delete'].$post({
                json,
            });

            if (!response.ok) {
                const errorData = (await response.json()) as ResponseType;
                const errorMessage =
                    'error' in errorData
                        ? errorData.error
                        : 'Failed to delete customer(s).';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (data) => {
            const count = 'data' in data ? data.data.length : 0;
            toast.success(`${count} customer(s) deleted.`);
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete customer(s).');
        },
    });

    return mutation;
};
