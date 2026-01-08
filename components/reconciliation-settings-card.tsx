'use client';

import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGetSettings, useUpdateSettings } from '@/features/settings/api';
import { useGetDocumentTypes } from '@/features/transactions/api/use-documents';

export function ReconciliationSettingsCard() {
    const { data: settings, isLoading } = useGetSettings();
    const { data: documentTypes = [], isLoading: docTypesLoading } =
        useGetDocumentTypes();
    const updateSettings = useUpdateSettings();

    // Get required document type IDs from settings
    const requiredDocTypeIds = settings?.requiredDocumentTypeIds ?? [];
    const requiredTypesCount = requiredDocTypeIds.length;
    const minRequiredDocuments = settings?.minRequiredDocuments ?? 0;

    // Local state for the minimum required input
    const [localMinRequired, setLocalMinRequired] =
        useState<number>(minRequiredDocuments);

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

    const toggleRequiredDocType = (docTypeId: string) => {
        const newRequiredIds = requiredDocTypeIds.includes(docTypeId)
            ? requiredDocTypeIds.filter((id: string) => id !== docTypeId)
            : [...requiredDocTypeIds, docTypeId];

        updateSettings.mutate({ requiredDocumentTypeIds: newRequiredIds });
    };

    if (isLoading || docTypesLoading) {
        return <div>Loading settings...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Reconciliation Conditions</CardTitle>
                <CardDescription>
                    Configure what conditions must be met for a transaction to
                    be considered reconciled.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Required Document Types for Reconciliation */}
                {documentTypes.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Label className="font-medium">
                                Required Documents for Reconciliation
                            </Label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p>
                                            Select which document types must be
                                            attached before a transaction can be
                                            marked as &quot;Reconciled&quot;.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="space-y-2">
                            {documentTypes.map((docType) => (
                                <div
                                    key={docType.id}
                                    className="flex items-center space-x-3"
                                >
                                    <Checkbox
                                        id={`required-${docType.id}`}
                                        checked={requiredDocTypeIds.includes(
                                            docType.id,
                                        )}
                                        onCheckedChange={() =>
                                            toggleRequiredDocType(docType.id)
                                        }
                                    />
                                    <Label
                                        htmlFor={`required-${docType.id}`}
                                        className="font-normal cursor-pointer flex-1"
                                    >
                                        {docType.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        {requiredTypesCount === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No required document types selected.
                                Transactions can be reconciled without document
                                verification.
                            </p>
                        )}
                    </div>
                )}

                {/* Minimum Required Documents Setting */}
                {requiredTypesCount > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="minRequiredDocs"
                                className="font-medium"
                            >
                                Minimum Required Documents
                            </Label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p>
                                            Set the minimum number of required
                                            document types that must be attached
                                            before a transaction can be marked
                                            as &quot;Reconciled&quot;.
                                        </p>
                                        <p className="mt-2">
                                            Set to 0 to require all{' '}
                                            {requiredTypesCount} required
                                            document type
                                            {requiredTypesCount > 1 ? 's' : ''}.
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
                                onChange={(e) =>
                                    handleMinRequiredChange(
                                        parseInt(e.target.value, 10) || 0,
                                    )
                                }
                                className="w-24"
                                disabled={isLoading || updateSettings.isPending}
                            />
                            <span className="text-sm text-muted-foreground">
                                of {requiredTypesCount} required type
                                {requiredTypesCount > 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {localMinRequired === 0
                                ? `All ${requiredTypesCount} required document type${requiredTypesCount > 1 ? 's' : ''} must be attached to reconcile a transaction.`
                                : `At least ${localMinRequired} of the ${requiredTypesCount} required document type${requiredTypesCount > 1 ? 's' : ''} must be attached to reconcile a transaction.`}
                        </p>
                    </div>
                )}

                {documentTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No document types available. Create document types in
                        the Document Types section to configure reconciliation
                        requirements.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
