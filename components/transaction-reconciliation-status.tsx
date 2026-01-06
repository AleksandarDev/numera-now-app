"use client";

import { CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReconciliationCondition = "hasReceipt" | "isReviewed" | "isApproved";

const CONDITION_LABELS: Record<ReconciliationCondition, string> = {
  hasReceipt: "Has Receipt/Document",
  isReviewed: "Is Reviewed",
  isApproved: "Is Approved",
};

interface TransactionReconciliationStatusProps {
  isReconciled: boolean;
  conditions: {
    name: ReconciliationCondition;
    met: boolean;
  }[];
}

export function TransactionReconciliationStatus({
  isReconciled,
  conditions,
}: TransactionReconciliationStatusProps) {
  if (conditions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reconciliation Status</CardTitle>
            <CardDescription>
              Transaction reconciliation requirements
            </CardDescription>
          </div>
          {isReconciled ? (
            <Badge variant="default" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Reconciled
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {conditions.map((condition) => (
            <div
              key={condition.name}
              className="flex items-center gap-2 text-sm"
            >
              {condition.met ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              <span
                className={
                  condition.met
                    ? "text-green-700"
                    : "text-amber-700"
                }
              >
                {CONDITION_LABELS[condition.name]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
