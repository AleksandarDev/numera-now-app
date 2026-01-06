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

type DocumentsColumnProps = {
  documentCount: number;
  hasAllRequiredDocuments: boolean;
  requiredDocumentTypes: number;
  attachedRequiredTypes: number;
  status: string;
};

export const DocumentsColumn = ({
  documentCount,
  hasAllRequiredDocuments,
  requiredDocumentTypes,
  attachedRequiredTypes,
  status,
}: DocumentsColumnProps) => {
  const showWarning = status !== "draft" && requiredDocumentTypes > 0 && !hasAllRequiredDocuments;
  const isReconciled = status === "reconciled";
  
  if (documentCount === 0 && !showWarning) {
    return (
      <span className="text-muted-foreground text-sm">—</span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Badge 
              variant="outline" 
              className={cn(
                "gap-1 px-2 py-0.5 text-xs font-normal",
                showWarning && "border-amber-300 bg-amber-50 text-amber-700",
                isReconciled && hasAllRequiredDocuments && "border-green-300 bg-green-50 text-green-700"
              )}
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
                {showWarning 
                  ? `${attachedRequiredTypes}/${requiredDocumentTypes} required document types attached`
                  : `All ${requiredDocumentTypes} required document type${requiredDocumentTypes > 1 ? "s" : ""} attached`
                }
              </p>
            )}
            {showWarning && (
              <p className="text-xs text-amber-600">
                Attach all required documents before completing this transaction.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
