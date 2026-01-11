import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['accounting-periods'][':id']['$delete']
>;

export const useDeleteAccountingPeriod = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, string>({
        mutationFn: async (id: string) => {
            const response = await client.api['accounting-periods'][
                ':id'
            ].$delete({
                param: { id },
            });
            return await response.json();
        },
        onSuccess: () => {
            toast.success('Accounting period deleted');
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
        },
        onError: () => {
            toast.error('Failed to delete accounting period');
        },
    });

    return mutation;
};
