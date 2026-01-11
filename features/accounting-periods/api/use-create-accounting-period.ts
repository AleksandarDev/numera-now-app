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

type SuccessResponse = Extract<ResponseType, { data: unknown }>;

export const useCreateAccountingPeriod = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<SuccessResponse, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['accounting-periods'].$post({
                json,
            });

            const result: ResponseType = await response.json();

            if (!response.ok || !('data' in result)) {
                const message =
                    'error' in result
                        ? result.error
                        : 'Failed to create accounting period';

                throw new Error(message);
            }

            return result;
        },
        onSuccess: () => {
            toast.success('Accounting period created');
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create accounting period');
        },
    });

    return mutation;
};
