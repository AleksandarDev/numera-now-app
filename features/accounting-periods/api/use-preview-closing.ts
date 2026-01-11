import { useMutation } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

type ResponseType = InferResponseType<
    (typeof client.api)['accounting-periods']['preview-closing']['$post']
>;
type RequestType = InferRequestType<
    (typeof client.api)['accounting-periods']['preview-closing']['$post']
>['json'];

export const usePreviewClosing = () => {
    const mutation = useMutation<ResponseType, Error, RequestType>({
        mutationFn: async (json) => {
            const response = await client.api['accounting-periods'][
                'preview-closing'
            ].$post({
                json,
            });
            return await response.json();
        },
        onError: () => {
            toast.error('Failed to generate closing preview');
        },
    });

    return mutation;
};
