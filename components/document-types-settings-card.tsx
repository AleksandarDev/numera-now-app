"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, Info } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useGetDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
} from "@/features/transactions/api/use-documents";
import { useGetSettings } from "@/features/settings/api/use-get-settings";
import { useUpdateSettings } from "@/features/settings/api/use-update-settings";
import { toast } from "sonner";

export function DocumentTypesSettingsCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isRequired: false,
  });

  const { data: documentTypes = [], isLoading, refetch } = useGetDocumentTypes();
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const createDocumentType = useCreateDocumentType();
  const updateDocumentType = useUpdateDocumentType();
  const deleteDocumentType = useDeleteDocumentType();

  // Count required document types
  const requiredTypesCount = documentTypes.filter(dt => dt.isRequired).length;
  const minRequiredDocuments = settings?.minRequiredDocuments ?? 0;

  // Local state for the minimum required input
  const [localMinRequired, setLocalMinRequired] = useState<number>(minRequiredDocuments);

  // Sync local state with settings
  useEffect(() => {
    if (settings?.minRequiredDocuments !== undefined) {
      setLocalMinRequired(settings.minRequiredDocuments);
    }
  }, [settings?.minRequiredDocuments]);

  const handleMinRequiredChange = (value: number) => {
    const newValue = Math.max(0, Math.min(value, requiredTypesCount));
    setLocalMinRequired(newValue);
    updateSettings.mutate({ minRequiredDocuments: newValue });
  };

  const handleOpenDialog = (docType?: (typeof documentTypes)[0]) => {
    if (docType) {
      setEditingId(docType.id);
      setFormData({
        name: docType.name,
        description: docType.description || "",
        isRequired: docType.isRequired,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
        isRequired: false,
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

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isRequired"
                  checked={formData.isRequired}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isRequired: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="isRequired"
                  className="font-medium cursor-pointer"
                >
                  Required for reconciliation
                </Label>
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

        {/* Minimum Required Documents Setting */}
        {requiredTypesCount > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="minRequiredDocs" className="font-medium text-blue-900">
                Minimum Required Documents
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-blue-600 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Set the minimum number of required document types that must be attached 
                      before a transaction can be marked as &quot;Completed&quot;.
                    </p>
                    <p className="mt-2">
                      Set to 0 to require all {requiredTypesCount} required document type{requiredTypesCount > 1 ? "s" : ""}.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="minRequiredDocs"
                type="number"
                min={0}
                max={requiredTypesCount}
                value={localMinRequired}
                onChange={(e) => handleMinRequiredChange(parseInt(e.target.value) || 0)}
                className="w-24"
                disabled={settingsLoading || updateSettings.isPending}
              />
              <span className="text-sm text-blue-800">
                of {requiredTypesCount} required type{requiredTypesCount > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-blue-700">
              {localMinRequired === 0 
                ? `All ${requiredTypesCount} required document type${requiredTypesCount > 1 ? "s" : ""} must be attached to complete a transaction.`
                : `At least ${localMinRequired} of the ${requiredTypesCount} required document type${requiredTypesCount > 1 ? "s" : ""} must be attached to complete a transaction.`
              }
            </p>
          </div>
        )}

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
                  {docType.isRequired && (
                    <p className="text-xs text-yellow-600">
                      Required for reconciliation
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
