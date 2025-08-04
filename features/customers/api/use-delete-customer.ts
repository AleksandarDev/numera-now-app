import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<typeof client.api.customers[":id"]["$delete"]>;

export const useDeleteCustomer = (id?: string) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error>({
        mutationFn: async () => {
            const response = await client.api.customers[":id"].$delete({
                param: { id },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error((errorData as any).error || "Failed to delete customer.");
            }
            return await response.json();
        },
        onSuccess: () => {
            toast.success("Customer deleted.");
            queryClient.invalidateQueries({ queryKey: ["customer", { id }] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
        },
        onError: (error) => {
            toast.error(error.message || "Failed to delete customer.");
        },
    });

    return mutation;
};
