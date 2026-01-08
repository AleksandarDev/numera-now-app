import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<typeof client.api.customers.$post>;
type RequestType = InferRequestType<typeof client.api.customers.$post>['json'];

export const useCreateCustomer = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api.customers.$post({ json });
            if (!response.ok) {
                throw new Error('Failed to create customer.');
            }
            return await response.json();
        },
        onSuccess: (response) => {
            toast.success('Customer created.');
            if ('data' in response) {
                const createdCustomer = response.data;
                queryClient.setQueriesData(
                    { queryKey: ['customers'] },
                    (oldData) => {
                        if (!Array.isArray(oldData)) {
                            return oldData;
                        }

                        const exists = oldData.some(
                            (customer) => customer.id === createdCustomer.id,
                        );
                        const next = exists
                            ? oldData.map((customer) =>
                                  customer.id === createdCustomer.id
                                      ? createdCustomer
                                      : customer,
                              )
                            : [...oldData, createdCustomer];

                        return [...next].sort((a, b) => {
                            const aName = a.name ?? '';
                            const bName = b.name ?? '';
                            const nameCompare = aName.localeCompare(
                                bName,
                                undefined,
                                {
                                    sensitivity: 'base',
                                },
                            );
                            if (nameCompare !== 0) return nameCompare;
                            return a.id.localeCompare(b.id);
                        });
                    },
                );
            }
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
        onError: () => {
            toast.error('Failed to create customer.');
        },
    });

    return mutation;
};
