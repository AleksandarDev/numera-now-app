import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api.banking.accounts)[':accountId']['$patch']
>;
type RequestType = InferRequestType<
    (typeof client.api.banking.accounts)[':accountId']['$patch']
>['json'];

export const useUpdateBankAccount = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        { accountId: string } & RequestType
    >({
        mutationFn: async ({ accountId, ...json }) => {
            const response = await client.api.banking.accounts[
                ':accountId'
            ].$patch({
                param: { accountId },
                json,
            });

            if (!response.ok) {
                const errorData = (await response.json()) as { error?: string };
                throw new Error(
                    errorData.error || 'Failed to update bank account.',
                );
            }

            return response.json();
        },
        onSuccess: () => {
            toast.success('Bank account updated.');
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update bank account.');
        },
    });

    return mutation;
};
