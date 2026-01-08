import { useQuery } from '@tanstack/react-query';
import { client } from '@/lib/hono';

export type SuggestedCategory = {
    categoryId: string;
    usageCount: number;
    lastUsed: string | null;
};

type SuggestedCategoriesOptions = {
    enabled?: boolean;
};

export const useGetSuggestedCategories = (
    customerId?: string,
    options?: SuggestedCategoriesOptions,
) => {
    const query = useQuery({
        enabled: Boolean(customerId) && (options?.enabled ?? true),
        queryKey: ['transactions', 'suggested-categories', { customerId }],
        queryFn: async () => {
            if (!customerId) {
                throw new Error('Customer ID is required');
            }

            const response = await client.api.transactions[
                'suggested-categories'
            ].$get({
                query: { customerId },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch suggested categories.');
            }

            const { data } = await response.json();
            return data as SuggestedCategory[];
        },
    });

    return query;
};
