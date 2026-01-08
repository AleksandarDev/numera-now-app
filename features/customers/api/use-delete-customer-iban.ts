import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

export const useDeleteCustomerIban = (customerId?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (ibanId: string) => {
            if (!customerId) throw new Error('Customer ID is required');

            const response = await client.api.customers[':id'].ibans[
                ':ibanId'
            ].$delete({
                param: { id: customerId, ibanId },
            });

            if (!response.ok) {
                throw new Error('Failed to delete IBAN');
            }

            const { data } = await response.json();
            return data;
        },
        onSuccess: () => {
            toast.success('IBAN deleted successfully');
            queryClient.invalidateQueries({
                queryKey: ['customer-ibans', { customerId }],
            });
        },
        onError: () => {
            toast.error('Failed to delete IBAN');
        },
    });

    return mutation;
};
