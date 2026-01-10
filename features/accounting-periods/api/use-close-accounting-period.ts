import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['accounting-periods'][':id']['close']['$patch']
>;

export const useCloseAccountingPeriod = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        { id: string; notes?: string }
    >({
        mutationFn: async ({ id, notes }) => {
            const response = await client.api['accounting-periods'][
                ':id'
            ].close.$patch({
                param: { id },
                json: { notes },
            });
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Accounting period closed');
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: () => {
            toast.error('Failed to close accounting period');
        },
    });

    return mutation;
};
