import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.tags)[':id']['$delete']
>;

export const useDeleteTag = (id?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.tags[':id'].$delete({
                param: { id },
            });

            return await response.json();
        },
        onSuccess: () => {
            toast.success('Tag deleted.');
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            queryClient.invalidateQueries({ queryKey: ['tag', { id }] });
        },
        onError: () => {
            toast.error('Failed to delete tag.');
        },
    });

    return mutation;
};
