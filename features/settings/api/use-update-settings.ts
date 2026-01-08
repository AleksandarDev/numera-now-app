import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.settings.$patch>;
type RequestType = InferRequestType<typeof client.api.settings.$patch>['json'];

export const useUpdateSettings = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.settings.$patch({ json });
            if (!response.ok) {
                throw new Error('Failed to update settings.');
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Settings updated.');
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: () => {
            toast.error('Failed to update settings.');
        },
    });

    return mutation;
};
