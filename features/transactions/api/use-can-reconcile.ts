import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export const useCanReconcile = (transactionId?: string) => {
    const query = useQuery({
        enabled: !!transactionId,
        queryKey: ['can-reconcile', { transactionId }],
        queryFn: async () => {
            if (!transactionId) throw new Error('Transaction ID is required');
            const response = await client.api.transactions[':id'][
                'can-reconcile'
            ].$get({
                param: { id: transactionId },
            });

            if (!response.ok) {
                throw new Error('Failed to check reconciliation status.');
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
