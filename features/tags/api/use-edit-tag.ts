import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.tags)[':id']['$patch']
>;
type RequestType = InferRequestType<
    (typeof client.api.tags)[':id']['$patch']
>['json'];

export const useEditTag = (id?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.tags[':id'].$patch({
                param: { id },
                json,
            });

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Tag updated.');
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            queryClient.invalidateQueries({ queryKey: ['tag', { id }] });
        },
        onError: () => {
            toast.error('Failed to update tag.');
        },
    });

    return mutation;
};
