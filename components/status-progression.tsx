"use client";

import { Fragment, useState } from "react";
import { ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TransactionStatus = "draft" | "pending" | "completed" | "reconciled";

const STATUS_INFO: Record<TransactionStatus, { label: string; description: string; color: string }> = {
  draft: {
    label: "Draft",
    description: "Transaction is being prepared",
    color: "bg-gray-100 text-gray-700 border-gray-300",
  },
  pending: {
    label: "Pending",
    description: "Transaction is pending confirmation",
    color: "bg-yellow-100 text-yellow-700 border-yellow-300",
  },
  completed: {
    label: "Completed",
    description: "Transaction has been completed",
    color: "bg-blue-100 text-blue-700 border-blue-300",
  },
  reconciled: {
    label: "Reconciled",
    description: "Transaction has been reconciled",
    color: "bg-green-100 text-green-700 border-green-300",
  },
};

const STATUS_ORDER: TransactionStatus[] = ["draft", "pending", "completed", "reconciled"];

interface StatusProgressionProps {
  currentStatus: TransactionStatus;
  onAdvance: (nextStatus: TransactionStatus) => Promise<void>;
  disabled?: boolean;
  canReconcile?: boolean;
  reconciliationBlockers?: string[];
  // Document validation props
  hasAllRequiredDocuments?: boolean;
  requiredDocumentTypes?: number;
  attachedRequiredTypes?: number;
  minRequiredDocuments?: number;
}

export function StatusProgression({
  currentStatus,
  onAdvance,
  disabled = false,
  canReconcile = true,
  reconciliationBlockers = [],
  hasAllRequiredDocuments = true,
  requiredDocumentTypes = 0,
  attachedRequiredTypes = 0,
  minRequiredDocuments = 0,
}: StatusProgressionProps) {
  const [isAdvancing, setIsAdvancing] = useState(false);

  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextStatus = currentIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIndex + 1] : null;

  // Check if document requirements block progression
  const getDocumentBlocker = (): string | null => {
    // Only check when advancing to reconciled
    if (nextStatus !== "reconciled") {
      return null;
    }

    // No required document types
    if (requiredDocumentTypes === 0 || hasAllRequiredDocuments) {
      return null;
    }

    // Generate appropriate message
    if (minRequiredDocuments === 0) {
      const missing = requiredDocumentTypes - attachedRequiredTypes;
      return `Attach ${missing} more required document type${missing > 1 ? "s" : ""}`;
    } else {
      const needed = Math.min(minRequiredDocuments, requiredDocumentTypes);
      const stillNeed = needed - attachedRequiredTypes;
      return `Attach ${stillNeed} more of the ${requiredDocumentTypes} required document types`;
    }
  };

  const documentBlocker = getDocumentBlocker();
  const isDocumentBlocked = documentBlocker !== null;

  const handleAdvance = async () => {
    if (!nextStatus || isAdvancing || disabled || isDocumentBlocked) return;

    // Check if trying to advance to reconciled but conditions aren't met
    if (nextStatus === "reconciled" && !canReconcile) {
      return;
    }

    setIsAdvancing(true);
    try {
      await onAdvance(nextStatus);
    } finally {
      setIsAdvancing(false);
    }
  };

  const isReconcileBlocked = nextStatus === "reconciled" && !canReconcile;

  return (
    <Card>
      <CardContent className="space-y-4 p-6 pb-4">
        {/* Status Timeline */}
        <div className="grid grid-cols-[repeat(7,1fr)]">
          {STATUS_ORDER.map((status, index) => {
            const isCurrent = status === currentStatus;
            const isPast = index < currentIndex;

            return (
              <Fragment key={status}>
                <div className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all",
                        isCurrent && STATUS_INFO[status].color,
                        isPast && "bg-green-50 border-green-300",
                        !isCurrent && !isPast && "bg-gray-50 border-gray-300"
                      )}
                    >
                      {isPast ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <span className={cn("text-sm font-semibold", isCurrent ? "" : "text-gray-400")}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={cn("text-xs font-medium", isCurrent ? "text-foreground" : "text-muted-foreground")}>
                        {STATUS_INFO[status].label}
                      </div>
                    </div>
                  </div>
                </div>
                {index < STATUS_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 mt-5",
                      index < currentIndex ? "bg-green-300" : "bg-gray-300"
                    )}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Current Status Info */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Badge className={STATUS_INFO[currentStatus].color}>
                {STATUS_INFO[currentStatus].label}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {STATUS_INFO[currentStatus].description}
              </p>
            </div>
            {nextStatus && (
              <Button
                onClick={handleAdvance}
                disabled={disabled || isAdvancing || isReconcileBlocked || isDocumentBlocked}
                className="gap-2"
              >
                {isAdvancing ? (
                  <>Processing...</>
                ) : (
                  <>
                    {STATUS_INFO[nextStatus].label}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Document Blockers */}
        {isDocumentBlocked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Cannot reconcile. Missing required documents:
                </p>
                <p className="text-sm text-amber-800">
                  {documentBlocker}
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  {minRequiredDocuments === 0
                    ? `${attachedRequiredTypes}/${requiredDocumentTypes} required document types attached`
                    : `${attachedRequiredTypes}/${Math.min(minRequiredDocuments, requiredDocumentTypes)} minimum required (of ${requiredDocumentTypes} types)`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Blockers */}
        {isReconcileBlocked && reconciliationBlockers.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Cannot reconcile yet. Please complete:
                </p>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  {reconciliationBlockers.map((blocker, idx) => (
                    <li key={idx}>{blocker}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Completed Status */}
        {currentStatus === "reconciled" && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-900">
                This transaction has been fully reconciled and completed.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
