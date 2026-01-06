import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/hono";
import { InferResponseType } from "hono";

// Get documents for a transaction
export const useGetDocuments = (transactionId: string) => {
  const query = useQuery({
    queryKey: ["documents", transactionId],
    queryFn: async () => {
      const response = await client.api.documents[":transactionId"].$get({
        param: { transactionId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};

// Get document types for user
export const useGetDocumentTypes = () => {
  const query = useQuery({
    queryKey: ["document-types"],
    queryFn: async () => {
      const response = await client.api["document-types"].$get();

      if (!response.ok) {
        throw new Error("Failed to fetch document types");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};

// Generate upload SAS URL
export const useGenerateUploadUrl = () => {
  const mutation = useMutation({
    mutationFn: async ({
      transactionId,
      fileName,
    }: {
      transactionId: string;
      fileName: string;
    }) => {
      const response = await client.api.documents["generate-upload-url"].$post({
        json: { transactionId, fileName },
      });

      if (!response.ok) {
        throw new Error("Failed to generate upload URL");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Upload document to Azure Blob Storage directly
export const useUploadDocumentToBlob = () => {
  const mutation = useMutation({
    mutationFn: async ({
      sasUrl,
      file,
    }: {
      sasUrl: string;
      file: File;
    }) => {
      const response = await fetch(sasUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to blob storage");
      }

      return response;
    },
  });

  return mutation;
};

// Save document metadata
export const useSaveDocument = () => {
  const mutation = useMutation({
    mutationFn: async ({
      transactionId,
      documentTypeId,
      fileName,
      fileSize,
      mimeType,
      storagePath,
    }: {
      transactionId: string;
      documentTypeId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storagePath: string;
    }) => {
      const response = await client.api.documents.$post({
        json: {
          transactionId,
          documentTypeId,
          fileName,
          fileSize,
          mimeType,
          storagePath,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to save document");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Upload document (combined operation)
export const useUploadDocument = () => {
  const generateUploadUrl = useGenerateUploadUrl();
  const uploadToBlob = useUploadDocumentToBlob();
  const saveDocument = useSaveDocument();

  const mutation = useMutation({
    mutationFn: async ({
      transactionId,
      documentTypeId,
      file,
    }: {
      transactionId: string;
      documentTypeId: string;
      file: File;
    }) => {
      // Step 1: Get upload URL
      const { uploadUrl } = await generateUploadUrl.mutateAsync({
        transactionId,
        fileName: file.name,
      });

      // Extract storage path from SAS URL
      const url = new URL(uploadUrl);
      const storagePath = url.pathname.substring(
        url.pathname.indexOf("/documents/") + "/documents/".length
      );

      // Step 2: Upload file to blob storage
      await uploadToBlob.mutateAsync({
        sasUrl: uploadUrl,
        file,
      });

      // Step 3: Save document metadata
      const data = await saveDocument.mutateAsync({
        transactionId,
        documentTypeId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
      });

      return data;
    },
  });

  return mutation;
};

// Get download URL
export const useGetDownloadUrl = (documentId: string) => {
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await client.api.documents[":id"]["download-url"].$get(
        {
          param: { id: documentId },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Delete document
export const useDeleteDocument = () => {
  const mutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await client.api.documents[":id"].$delete({
        param: { id: documentId },
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Create document type
export const useCreateDocumentType = () => {
  const mutation = useMutation({
    mutationFn: async ({
      name,
      description,
      isRequired,
    }: {
      name: string;
      description?: string;
      isRequired?: boolean;
    }) => {
      const response = await client.api["document-types"].$post({
        json: {
          name,
          description,
          isRequired: isRequired || false,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create document type");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Update document type
export const useUpdateDocumentType = () => {
  const mutation = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      isRequired,
    }: {
      id: string;
      name?: string;
      description?: string;
      isRequired?: boolean;
    }) => {
      const response = await client.api["document-types"][":id"].$patch({
        param: { id },
        json: {
          name,
          description,
          isRequired,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to update document type");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};

// Delete document type
export const useDeleteDocumentType = () => {
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await client.api["document-types"][":id"].$delete({
        param: { id },
      });

      if (!response.ok) {
        throw new Error("Failed to delete document type");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return mutation;
};
