import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';
import { convertAmountFromMiliunits } from '@/lib/utils';

export const useGetSplitGroup = (splitGroupId?: string | null) => {
    const query = useQuery({
        enabled: !!splitGroupId,
        queryKey: ['split-group', { splitGroupId }],
        queryFn: async () => {
            if (!splitGroupId) throw new Error('Split group ID is required');
            const response = await client.api.transactions['split-group'][
                ':splitGroupId'
            ].$get({
                param: { splitGroupId: splitGroupId },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch split group transactions.');
            }

            const { data } = await response.json();
            return data.map((tx) => ({
                ...tx,
                amount: convertAmountFromMiliunits(tx.amount),
            }));
        },
    });

    return query;
};
