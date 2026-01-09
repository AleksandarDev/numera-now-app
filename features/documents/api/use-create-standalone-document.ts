import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';

interface CreateStandaloneDocumentParams {
    documentTypeId: string;
    file: File;
}

export const useCreateStandaloneDocument = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({
            documentTypeId,
            file,
        }: CreateStandaloneDocumentParams) => {
            // Generate upload URL for standalone document
            const uploadUrlResponse = await client.api.documents[
                'generate-standalone-upload-url'
            ].$post({
                json: {
                    fileName: file.name,
                },
            });

            if (!uploadUrlResponse.ok) {
                throw new Error('Failed to get upload URL');
            }

            const { data: uploadData } = await uploadUrlResponse.json();

            // Upload file directly to Azure Blob Storage
            const uploadResponse = await fetch(uploadData.uploadUrl, {
                method: 'PUT',
                headers: {
                    'x-ms-blob-type': 'BlockBlob',
                    'Content-Type': file.type,
                },
                body: file,
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            // Save document metadata
            const metadataResponse =
                await client.api.documents.standalone.$post({
                    json: {
                        documentTypeId,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type,
                        storagePath: uploadData.storagePath,
                    },
                });

            if (!metadataResponse.ok) {
                throw new Error('Failed to save document');
            }

            return await metadataResponse.json();
        },
        onSuccess: () => {
            toast.success('Document uploaded successfully');
            queryClient.invalidateQueries({ queryKey: ['all-documents'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to upload document');
        },
    });

    return mutation;
};
