import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.dashboard.$patch>;
type RequestType = InferRequestType<typeof client.api.dashboard.$patch>['json'];

export const useUpdateDashboardLayout = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.dashboard.$patch({ json });
            if (!response.ok) {
                throw new Error('Failed to update dashboard layout.');
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Dashboard layout saved.');
            queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
        },
        onError: () => {
            toast.error('Failed to save dashboard layout.');
        },
    });

    return mutation;
};
