"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Download, Trash2, Loader2, FileText, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUploadDocument,
  useGetDocuments,
  useGetDocumentTypes,
  useDeleteDocument,
  useUpdateDocument,
} from "@/features/transactions/api/use-documents";
import { DocumentDropzone } from "@/components/document-dropzone";
import { client } from "@/lib/hono";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  transactionId: string;
  defaultDocumentTypeId?: string;
}

export function DocumentUpload({ transactionId, defaultDocumentTypeId }: DocumentUploadProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(defaultDocumentTypeId || "auto");
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documentTypes = [], isLoading: typesLoading } = useGetDocumentTypes();
  const uploadDocument = useUploadDocument();

  const handleFilesAccepted = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Get the first available document type if none selected or "auto" is selected
    const typeIdToUse = selectedTypeId === "auto" ? documentTypes[0]?.id : selectedTypeId;

    if (!typeIdToUse) {
      toast.error("No document types available. Please create a document type first.");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        await uploadDocument.mutateAsync({
          transactionId,
          documentTypeId: typeIdToUse,
          file,
        });
        successCount++;
      } catch (error) {
        console.error("Upload error for file:", file.name, error);
        errorCount++;

        // Extract more detailed error information
        let errorMessage = `${file.name}: `;
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          errorMessage += "Network error. This may be due to CORS configuration on Azure Storage.";
        } else if (error instanceof Error) {
          errorMessage += error.message;
        } else {
          errorMessage += "Unknown error";
        }
        errors.push(errorMessage);
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["documents", transactionId] });
      // Invalidate transaction queries to refresh validation status in transaction table
      queryClient.invalidateQueries({ queryKey: ["transaction", { id: transactionId }] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} document${successCount > 1 ? "s" : ""} uploaded successfully`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} uploaded, ${errorCount} failed`);
      // Show first error as example
      if (errors.length > 0) {
        toast.error(errors[0], { duration: 5000 });
      }
    } else {
      toast.error("Failed to upload documents");
      // Show first error as example
      if (errors.length > 0) {
        toast.error(errors[0], { duration: 5000 });
      }
    }

    // Reset type selection after upload
    setSelectedTypeId("auto");
  }, [selectedTypeId, documentTypes, transactionId, uploadDocument, queryClient]);

  return (
    <div className="space-y-4">
      {/* Optional: Pre-select document type before dropping */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Document type (optional):</span>
        <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Auto-assign first type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-assign first type</SelectItem>
            {documentTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DocumentDropzone
        onFilesAccepted={handleFilesAccepted}
        isUploading={isUploading || uploadDocument.isPending}
        disabled={typesLoading || documentTypes.length === 0}
      />

      {documentTypes.length === 0 && !typesLoading && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span>No document types configured. Go to Settings to add document types.</span>
        </div>
      )}
    </div>
  );
}

interface DocumentListProps {
  transactionId: string;
}

export function DocumentList({ transactionId }: DocumentListProps) {
  const { data: documents, isLoading } = useGetDocuments(transactionId);
  const { data: documentTypes = [] } = useGetDocumentTypes();
  const deleteDocument = useDeleteDocument();
  const updateDocument = useUpdateDocument();
  const queryClient = useQueryClient();

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await client.api.documents[":id"]["download-url"].$get({
        param: { id: documentId },
      });

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const { data } = await response.json();
      window.open(data.downloadUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocument.mutateAsync(documentId);
      queryClient.invalidateQueries({ queryKey: ["documents", transactionId] });
      // Invalidate transaction queries to refresh validation status in transaction table
      queryClient.invalidateQueries({ queryKey: ["transaction", { id: transactionId }] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Document deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleTypeChange = async (documentId: string, newTypeId: string) => {
    try {
      await updateDocument.mutateAsync({
        id: documentId,
        documentTypeId: newTypeId,
      });
      queryClient.invalidateQueries({ queryKey: ["documents", transactionId] });
      // Invalidate transaction queries to refresh validation status in transaction table
      queryClient.invalidateQueries({ queryKey: ["transaction", { id: transactionId }] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Document type updated");
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update document type");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading documents...
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          No documents attached yet
        </p>
        <p className="text-xs text-muted-foreground/70">
          Drag and drop files above to attach documents
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Attached Documents ({documents.length})
      </h4>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{doc.fileName}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {/* Editable document type */}
              <Select
                value={doc.documentTypeId}
                onValueChange={(value) => handleTypeChange(doc.id, value)}
              >
                <SelectTrigger className={cn(
                  "h-6 w-auto gap-1 border-none bg-transparent px-0 text-xs font-medium",
                  "hover:bg-accent hover:text-accent-foreground"
                )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>•</span>
              <span>{formatFileSize(doc.fileSize)}</span>
              <span>•</span>
              <span>
                {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDownload(doc.id, doc.fileName)}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(doc.id)}
              disabled={deleteDocument.isPending}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsTabProps {
  transactionId: string;
}

export function DocumentsTab({ transactionId }: DocumentsTabProps) {
  return (
    <div className="space-y-6">
      <DocumentUpload transactionId={transactionId} />
      <DocumentList transactionId={transactionId} />
    </div>
  );
}
