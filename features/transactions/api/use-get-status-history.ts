import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/hono";

export const useGetStatusHistory = (id?: string) => {
  const query = useQuery({
    enabled: !!id,
    queryKey: ["transaction-status-history", { id }],
    queryFn: async () => {
      const response = await client.api.transactions[":id"]["status-history"].$get({
        param: { id: id! },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transaction status history.");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
