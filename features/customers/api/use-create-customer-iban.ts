import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type RequestType = {
    iban: string;
    bankName?: string;
};

export const useCreateCustomerIban = (customerId?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (json: RequestType) => {
            if (!customerId) throw new Error('Customer ID is required');

            const response = await client.api.customers[':id'].ibans.$post({
                param: { id: customerId },
                json,
            });

            if (!response.ok) {
                throw new Error('Failed to create IBAN');
            }

            const { data } = await response.json();
            return data;
        },
        onSuccess: () => {
            toast.success('IBAN added successfully');
            queryClient.invalidateQueries({
                queryKey: ['customer-ibans', { customerId }],
            });
        },
        onError: () => {
            toast.error('Failed to add IBAN');
        },
    });

    return mutation;
};
