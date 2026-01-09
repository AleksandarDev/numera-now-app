import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.tags)['bulk-delete']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api.tags)['bulk-delete']['$post']
>['json'];

export const useBulkDeleteTags = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.tags['bulk-delete'].$post({
                json,
            });

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Tags deleted.');
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
        onError: () => {
            toast.error('Failed to delete tags.');
        },
    });

    return mutation;
};
