import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api)['api-keys']['$post']>;
type RequestType = InferRequestType<
    (typeof client.api)['api-keys']['$post']
>['json'];

export const useCreateApiKey = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['api-keys'].$post({ json });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(errorData.error || 'Failed to create API key.');
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('API key created.');
            queryClient.invalidateQueries({ queryKey: ['api-keys'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create API key.');
        },
    });

    return mutation;
};
