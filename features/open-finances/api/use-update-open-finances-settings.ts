import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['open-finances']['$patch']
>;
type RequestType = InferRequestType<
    (typeof client.api)['open-finances']['$patch']
>['json'];

export const useUpdateOpenFinancesSettings = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['open-finances'].$patch({ json });
            if (!response.ok) {
                throw new Error('Failed to update open finances settings.');
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Open finances settings updated.');
            queryClient.invalidateQueries({
                queryKey: ['open-finances-settings'],
            });
        },
        onError: () => {
            toast.error('Failed to update open finances settings.');
        },
    });

    return mutation;
};
