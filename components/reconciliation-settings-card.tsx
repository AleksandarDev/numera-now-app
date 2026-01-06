"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetSettings, useUpdateSettings } from "@/features/settings/api";
import { toast } from "sonner";

type ReconciliationCondition = "hasReceipt" | "isReviewed" | "isApproved";

const CONDITION_LABELS: Record<ReconciliationCondition, string> = {
  hasReceipt: "Has Receipt/Document",
  isReviewed: "Is Reviewed",
  isApproved: "Is Approved",
};

const CONDITION_DESCRIPTIONS: Record<ReconciliationCondition, string> = {
  hasReceipt: "Transaction must have at least one attached document",
  isReviewed: "Transaction must be marked as reviewed",
  isApproved: "Transaction must be approved",
};

export function ReconciliationSettingsCard() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const [selectedConditions, setSelectedConditions] = useState<
    ReconciliationCondition[]
  >(() => {
    if (!settings?.reconciliationConditions) {
      return ["hasReceipt"];
    }
    return Array.isArray(settings.reconciliationConditions)
      ? settings.reconciliationConditions
      : JSON.parse(settings.reconciliationConditions || '["hasReceipt"]');
  });

  const toggleCondition = (condition: ReconciliationCondition) => {
    setSelectedConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        doubleEntryMode: settings?.doubleEntryMode || false,
        reconciliationConditions: selectedConditions,
      });
      toast.success("Reconciliation conditions updated");
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Conditions</CardTitle>
        <CardDescription>
          Configure what conditions must be met for a transaction to be considered reconciled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {(Object.keys(CONDITION_LABELS) as ReconciliationCondition[]).map(
            (condition) => (
              <div key={condition} className="flex items-start space-x-3">
                <Checkbox
                  id={condition}
                  checked={selectedConditions.includes(condition)}
                  onCheckedChange={() => toggleCondition(condition)}
                />
                <div className="flex-1">
                  <Label htmlFor={condition} className="font-medium cursor-pointer">
                    {CONDITION_LABELS[condition]}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {CONDITION_DESCRIPTIONS[condition]}
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? "Saving..." : "Save Conditions"}
        </Button>
      </CardContent>
    </Card>
  );
}
