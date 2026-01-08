import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/hono";

export const useGetCustomerIbans = (customerId?: string) => {
    const query = useQuery({
        enabled: !!customerId,
        queryKey: ["customer-ibans", { customerId }],
        queryFn: async () => {
            const response = await client.api.customers[":id"].ibans.$get({
                param: { id: customerId! },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch customer IBANs");
            }

            const { data } = await response.json();
            return data;
        },
    });

    return query;
};
