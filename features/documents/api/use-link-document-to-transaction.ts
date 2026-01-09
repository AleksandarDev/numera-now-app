import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

interface LinkDocumentToTransactionParams {
    documentId: string;
    transactionId: string;
}

export const useLinkDocumentToTransaction = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({
            documentId,
            transactionId,
        }: LinkDocumentToTransactionParams) => {
            const response = await client.api.documents[':id'].link.$post({
                param: { id: documentId },
                json: { transactionId },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage =
                    (errorData as { error?: string })?.error ||
                    'Failed to link document to transaction.';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            toast.success('Document linked to transaction');
            queryClient.invalidateQueries({ queryKey: ['all-documents'] });
            queryClient.invalidateQueries({
                queryKey: ['documents', variables.transactionId],
            });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to link document');
        },
    });

    return mutation;
};
