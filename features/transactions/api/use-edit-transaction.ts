import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<
  (typeof client.api.transactions)[":id"]["$patch"]
>;
type RequestType = InferRequestType<
  (typeof client.api.transactions)[":id"]["$patch"]
>["json"];

export const useEditTransaction = (id?: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.transactions[":id"]["$patch"]({
        json,
        param: { id },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = (errorData as { error?: string })?.error || "Failed to edit transaction.";
        console.error('[useEditTransaction] Error:', { status: response.status, errorData });
        throw new Error(errorMessage);
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Transaction updated.");
      queryClient.invalidateQueries({ queryKey: ["transaction", { id }] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to edit transaction.");
    },
  });

  return mutation;
};