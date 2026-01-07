"use client";

import { FileText, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";

type DocumentsColumnProps = {
  documentCount: number;
  hasAllRequiredDocuments: boolean;
  requiredDocumentTypes: number;
  attachedRequiredTypes: number;
  status: string;
  transactionId: string;
  minRequiredDocuments?: number;
};

export const DocumentsColumn = ({
  documentCount,
  hasAllRequiredDocuments,
  requiredDocumentTypes,
  attachedRequiredTypes,
  status,
  transactionId,
  minRequiredDocuments = 0,
}: DocumentsColumnProps) => {
  const { onOpen } = useOpenTransaction();
  const showWarning = status !== "draft" && requiredDocumentTypes > 0 && !hasAllRequiredDocuments;
  const isReconciled = status === "reconciled";

  // Calculate the effective minimum required
  const effectiveMinRequired = minRequiredDocuments === 0 
    ? requiredDocumentTypes 
    : Math.min(minRequiredDocuments, requiredDocumentTypes);

  if (documentCount === 0 && !showWarning) {
    return (
      <span className="text-muted-foreground text-sm">—</span>
    );
  }

  const handleClick = () => {
    onOpen(transactionId, "documents");
  };

  // Generate appropriate message based on min required setting
  const getRequirementMessage = () => {
    if (minRequiredDocuments === 0) {
      // All required types needed
      return showWarning
        ? `${attachedRequiredTypes}/${requiredDocumentTypes} required document types attached`
        : `All ${requiredDocumentTypes} required document type${requiredDocumentTypes > 1 ? "s" : ""} attached`;
    } else {
      // At least N required
      return showWarning
        ? `${attachedRequiredTypes}/${effectiveMinRequired} minimum required (of ${requiredDocumentTypes} types)`
        : `Document requirement met (${attachedRequiredTypes}/${effectiveMinRequired} minimum)`;
    }
  };

  const getWarningMessage = () => {
    if (minRequiredDocuments === 0) {
      return "Attach all required documents before completing this transaction.";
    } else {
      return `Attach at least ${effectiveMinRequired} of the ${requiredDocumentTypes} required document types before completing this transaction.`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 px-2 py-0.5 text-xs font-normal cursor-pointer hover:bg-accent transition-colors",
                showWarning && "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
                isReconciled && hasAllRequiredDocuments && "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              )}
              onClick={handleClick}
            >
              <FileText className="h-3 w-3" />
              {documentCount}
            </Badge>
            {showWarning && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">
              {documentCount} document{documentCount !== 1 ? "s" : ""} attached
            </p>
            {requiredDocumentTypes > 0 && (
              <p className={cn(
                "text-xs",
                showWarning ? "text-amber-600" : "text-green-600"
              )}>
                {getRequirementMessage()}
              </p>
            )}
            {showWarning && (
              <p className="text-xs text-amber-600">
                {getWarningMessage()}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Click to view/manage documents
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
