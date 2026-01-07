"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useGetDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
} from "@/features/transactions/api/use-documents";
import { toast } from "sonner";

export function DocumentTypesSettingsCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: documentTypes = [], isLoading, refetch } = useGetDocumentTypes();
  const createDocumentType = useCreateDocumentType();
  const updateDocumentType = useUpdateDocumentType();
  const deleteDocumentType = useDeleteDocumentType();

  const handleOpenDialog = (docType?: (typeof documentTypes)[0]) => {
    if (docType) {
      setEditingId(docType.id);
      setFormData({
        name: docType.name,
        description: docType.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Document type name is required");
      return;
    }

    try {
      if (editingId) {
        await updateDocumentType.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success("Document type updated");
      } else {
        await createDocumentType.mutateAsync(formData);
        toast.success("Document type created");
      }

      setDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error(
        editingId
          ? "Failed to update document type"
          : "Failed to create document type"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document type?")) return;

    try {
      await deleteDocumentType.mutateAsync(id);
      toast.success("Document type deleted");
      refetch();
    } catch (error) {
      toast.error("Failed to delete document type");
    }
  };

  if (isLoading) {
    return <div>Loading document types...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Types</CardTitle>
        <CardDescription>
          Define document types that can be attached to transactions (e.g., Receipt, Invoice, Contract).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document Type
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Document Type" : "Create Document Type"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Receipt, Invoice, Contract"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional description"
                />
              </div>

              <Button
                type="submit"
                disabled={
                  createDocumentType.isPending || updateDocumentType.isPending
                }
              >
                {editingId ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          {documentTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document types created yet.
            </p>
          ) : (
            documentTypes.map((docType) => (
              <div
                key={docType.id}
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{docType.name}</p>
                  {docType.description && (
                    <p className="text-sm text-muted-foreground">
                      {docType.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(docType)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(docType.id)}
                    disabled={deleteDocumentType.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
