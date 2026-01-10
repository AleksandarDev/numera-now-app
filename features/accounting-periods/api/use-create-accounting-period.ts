import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['accounting-periods']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api)['accounting-periods']['$post']
>['json'];

export const useCreateAccountingPeriod = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['accounting-periods'].$post({
                json,
            });
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Accounting period created');
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
        },
        onError: () => {
            toast.error('Failed to create accounting period');
        },
    });

    return mutation;
};
