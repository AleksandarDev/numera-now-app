import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<
  (typeof client.api.accounts)["bulk-create"]["$post"]
>;
type RequestType = InferRequestType<
  (typeof client.api.accounts)["bulk-create"]["$post"]
>["json"];

export const useBulkCreateAccounts = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.accounts["bulk-create"]["$post"]({
        json,
      });
      if (!response.ok) {
        throw new Error("Failed to create accounts(s).");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Accounts(s) created.");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: () => {
      toast.error("Failed to create accounts(s).");
    },
  });

  return mutation;
};