import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.banking.connections)[':connectionId']['complete']['$post']
>;

export const useCompleteBankConnection = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        { connectionId: string; code: string }
    >({
        mutationFn: async ({ connectionId, code }) => {
            const response = await client.api.banking.connections[
                ':connectionId'
            ].complete.$post({
                param: { connectionId },
                json: { code },
            });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error || 'Failed to complete bank connection.',
                );
            }

            return response.json();
        },
        onSuccess: (data) => {
            if ('data' in data) {
                if (data.data.status === 'linked') {
                    toast.success(
                        data.data.message || 'Bank connected successfully.',
                    );
                } else {
                    toast.info(
                        data.data.message ||
                            'Bank connection is pending authorization.',
                    );
                }
            }
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to complete bank connection.');
        },
    });

    return mutation;
};
