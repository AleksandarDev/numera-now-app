import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/hono";
import { useSearchParams } from "next/navigation";

export const useGetAccounts = (options?: { search?: string, page?: number, pageSize?: number, accountId?: string | null, showClosed?: boolean }) => {
    const searchParams = useSearchParams();
    const paramsAccountId = searchParams.get("accountId") ?? undefined;
    const { page, pageSize, accountId, search, showClosed } = options || {};
    const resolvedAccountId = typeof accountId === 'undefined' ? paramsAccountId : accountId;
    const query = useQuery({
        queryKey: ["accounts", { search, page, pageSize, accountId: resolvedAccountId, showClosed }],
        queryFn: async () => {
            const response = await client.api.accounts.$get({
                query: {
                    search,
                    page: page?.toString(),
                    pageSize: pageSize?.toString(),
                    accountId: resolvedAccountId ?? undefined,
                    showClosed: showClosed?.toString(),
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch accounts");
            }

            const { data } = await response.json();
            return data;
        }
    });

    return query;
};