import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetAccountBalances = () => {
    const query = useQuery({
        queryKey: ['account-balances'],
        queryFn: async () => {
            const response = await client.api.accounts.balances.open.$get();

            if (!response.ok) {
                throw new Error('Failed to fetch account balances');
            }

            const { data } = await response.json();

            // Convert balances from miliunits
            const convertedBalances: Record<string, number> = {};
            for (const [accountId, balance] of Object.entries(data)) {
                convertedBalances[accountId] = convertAmountFromMiliunits(
                    balance as number,
                );
            }

            return convertedBalances;
        },
        // Refresh every 30 seconds to keep balances reasonably current
        staleTime: 30 * 1000,
    });

    return query;
};
