import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['accounting-periods']['create-closing-entries']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api)['accounting-periods']['create-closing-entries']['$post']
>['json'];

export const useCreateClosingEntries = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['accounting-periods'][
                'create-closing-entries'
            ].$post({
                json,
            });
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Closing entries created');
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
        onError: () => {
            toast.error('Failed to create closing entries');
        },
    });

    return mutation;
};
