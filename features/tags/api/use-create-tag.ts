import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.tags.$post>;
type RequestType = InferRequestType<typeof client.api.tags.$post>['json'];

export const useCreateTag = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.tags.$post({ json });

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Tag created.');
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
        onError: () => {
            toast.error('Failed to create tag.');
        },
    });

    return mutation;
};
