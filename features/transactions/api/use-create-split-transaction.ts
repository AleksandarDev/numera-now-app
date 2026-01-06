import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<
  (typeof client.api.transactions)["create-split"]["$post"]
>;
type RequestType = InferRequestType<
  (typeof client.api.transactions)["create-split"]["$post"]
>["json"];

export const useCreateSplitTransaction = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.transactions["create-split"].$post({ json });
      if (!response.ok) {
        throw new Error("Failed to create split transaction.");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Split transaction created.");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: () => {
      toast.error("Failed to create split transaction.");
    },
  });

  return mutation;
};
