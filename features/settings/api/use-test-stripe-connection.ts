import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.stripe.test.$post>;

export const useTestStripeConnection = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.stripe.test.$post();
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    (error as { error?: string }).error ||
                        'Failed to test Stripe connection.',
                );
            }
            return await response.json();
        },
        onSuccess: (response) => {
            if ('data' in response) {
                const {
                    businessName,
                    email,
                    accountId,
                    availableBalance,
                    currency,
                } = response.data;
                const displayName =
                    businessName || email || accountId || 'your account';
                const balanceAmount = (availableBalance / 100).toFixed(2);
                const formattedBalance = `${balanceAmount} ${currency.toUpperCase()}`;

                toast.success(
                    `Connected to Stripe: ${displayName}\nAvailable balance: ${formattedBalance}`,
                );
            }
            queryClient.invalidateQueries({ queryKey: ['stripe-settings'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to test Stripe connection.');
        },
    });

    return mutation;
};
