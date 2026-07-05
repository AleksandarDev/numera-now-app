import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['api-keys'][':id']['$delete']
>;

export const useRevokeApiKey = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, { id: string }>({
        mutationFn: async ({ id }) => {
            const response = await client.api['api-keys'][':id'].$delete({
                param: { id },
            });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(errorData.error || 'Failed to revoke API key.');
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('API key revoked.');
            queryClient.invalidateQueries({ queryKey: ['api-keys'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to revoke API key.');
        },
    });

    return mutation;
};
