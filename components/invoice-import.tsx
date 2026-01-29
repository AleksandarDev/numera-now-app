'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { InvoiceZipDropzone } from '@/components/invoice-zip-dropzone';
import {
    type ImportedInvoiceResult,
    useImportInvoiceZip,
} from '@/features/transactions/api/use-import-invoice-zip';
import { cn } from '@/lib/utils';

interface InvoiceImportProps {
    onComplete?: () => void;
    onOpenTransaction?: (
        id: string,
        tab?: 'details' | 'documents' | 'history',
    ) => void;
}

type ImportStep = 'select-file' | 'importing' | 'complete';

export function InvoiceImport({
    onComplete,
    onOpenTransaction,
}: InvoiceImportProps) {
    const [step, setStep] = useState<ImportStep>('select-file');
    const [results, setResults] = useState<ImportedInvoiceResult[]>([]);

    const importMutation = useImportInvoiceZip(onOpenTransaction, () => {
        setStep('complete');
        if (onComplete) {
            onComplete();
        }
    });

    const handleZipAccepted = async (file: File) => {
        setStep('importing');
        const result = await importMutation.mutateAsync({
            zipFile: file,
        });
        setResults(result);
    };

    const handleReset = () => {
        setStep('select-file');
        setResults([]);
    };

    // Render based on current step
    if (step === 'select-file') {
        return (
            <div className="space-y-4">
                <InvoiceZipDropzone
                    onZipAccepted={handleZipAccepted}
                    isProcessing={false}
                />
            </div>
        );
    }

    if (step === 'importing') {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                    <p className="text-sm font-medium">Importing invoices...</p>
                    <p className="text-xs text-muted-foreground">
                        This may take a moment
                    </p>
                </div>
            </div>
        );
    }

    if (step === 'complete') {
        const successCount = results.filter((r) => r.success).length;
        const errorCount = results.filter((r) => !r.success).length;

        return (
            <div className="space-y-6">
                {/* Summary */}
                <div
                    className={cn(
                        'rounded-md p-4 text-center',
                        successCount > 0 && errorCount === 0
                            ? 'bg-green-50 dark:bg-green-950'
                            : errorCount > 0 && successCount === 0
                              ? 'bg-red-50 dark:bg-red-950'
                              : 'bg-yellow-50 dark:bg-yellow-950',
                    )}
                >
                    <Check
                        className={cn(
                            'mx-auto h-8 w-8 mb-2',
                            successCount > 0 && errorCount === 0
                                ? 'text-green-600'
                                : errorCount > 0 && successCount === 0
                                  ? 'text-red-600'
                                  : 'text-yellow-600',
                        )}
                    />
                    <p className="font-medium">
                        {successCount > 0 && errorCount === 0
                            ? `Successfully imported ${successCount} invoice${successCount > 1 ? 's' : ''}`
                            : errorCount > 0 && successCount === 0
                              ? 'Failed to import invoices'
                              : `Imported ${successCount}, failed ${errorCount}`}
                    </p>
                </div>

                {/* Results list */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {results.map((result) => (
                        <div
                            key={result.invoiceNumber}
                            className={cn(
                                'flex items-center justify-between rounded-md border p-3',
                                result.success
                                    ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/50'
                                    : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/50',
                            )}
                        >
                            <div>
                                <p className="text-sm font-medium">
                                    {result.invoiceNumber}
                                </p>
                                {result.success ? (
                                    <p className="text-xs text-muted-foreground">
                                        {result.documentsUploaded} document
                                        {result.documentsUploaded !== 1
                                            ? 's'
                                            : ''}{' '}
                                        attached
                                    </p>
                                ) : (
                                    <p className="text-xs text-red-600">
                                        {result.error}
                                    </p>
                                )}
                            </div>
                            {result.success && result.transactionId && (
                                <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={() => {
                                        if (result.transactionId) {
                                            onOpenTransaction?.(
                                                result.transactionId,
                                                'details',
                                            );
                                        }
                                    }}
                                >
                                    View
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <Button variant="outlined" onClick={handleReset}>
                        Import More
                    </Button>
                    <Button onClick={onComplete}>Done</Button>
                </div>
            </div>
        );
    }

    return null;
}
