"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { FileUp, Download, Trash2, Loader } from "lucide-react";

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
  useGetDownloadUrl,
} from "@/features/transactions/api/use-documents";
import { toast } from "sonner";

interface DocumentUploadProps {
  transactionId: string;
}

export function DocumentUpload({ transactionId }: DocumentUploadProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: documentTypes = [], isLoading: typesLoading } =
    useGetDocumentTypes();
  const uploadDocument = useUploadDocument();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedTypeId) {
      toast.error("Please select a document type");
      return;
    }

    try {
      await uploadDocument.mutateAsync({
        transactionId,
        documentTypeId: selectedTypeId,
        file,
      });

      toast.success("Document uploaded successfully");
      setSelectedTypeId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelect}
      />

      <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select document type" />
        </SelectTrigger>
        <SelectContent>
          {documentTypes.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={
          uploadDocument.isPending || !selectedTypeId || typesLoading
        }
      >
        {uploadDocument.isPending ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        Upload
      </Button>
    </div>
  );
}

interface DocumentListProps {
  transactionId: string;
}

export function DocumentList({ transactionId }: DocumentListProps) {
  const { data: documents = [], isLoading } = useGetDocuments(transactionId);
  const deleteDocument = useDeleteDocument();
  const getDownloadUrl = useGetDownloadUrl("");

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl.mutateAsync();
      // Open in new tab or download
      window.open(downloadUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocument.mutateAsync(documentId);
      toast.success("Document deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading documents...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No documents attached yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex-1">
            <p className="font-medium">{doc.fileName}</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{doc.documentTypeName}</span>
              <span>{(doc.fileSize / 1024).toFixed(2)} KB</span>
              <span>
                {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDownload(doc.id, doc.fileName)}
              disabled={getDownloadUrl.isPending}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(doc.id)}
              disabled={deleteDocument.isPending}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface DocumentsTabProps {
  transactionId: string;
}

export function DocumentsTab({ transactionId }: DocumentsTabProps) {
  return (
    <div className="space-y-4">
      <DocumentUpload transactionId={transactionId} />
      <DocumentList transactionId={transactionId} />
    </div>
  );
}
