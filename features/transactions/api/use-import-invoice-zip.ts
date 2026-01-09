import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';
import {
    parseInvoiceZip,
    type ZipInvoiceEntry,
} from '@/lib/invoice-xml-parser';
import { convertAmountToMiliunits } from '@/lib/utils';

export interface ImportedInvoiceResult {
    success: boolean;
    transactionId?: string;
    invoiceNumber: string;
    error?: string;
    documentsUploaded: number;
}

interface ImportInvoiceZipInput {
    zipFile: File;
    creditAccountId?: string;
    debitAccountId?: string;
}

export const useImportInvoiceZip = (
    onOpen?: (id: string, tab?: 'details' | 'documents' | 'history') => void,
    onComplete?: () => void,
) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ImportedInvoiceResult[],
        Error,
        ImportInvoiceZipInput
    >({
        mutationFn: async ({ zipFile, creditAccountId, debitAccountId }) => {
            // Step 1: Parse the ZIP file
            const entries = await parseInvoiceZip(zipFile);

            if (entries.length === 0) {
                throw new Error(
                    'No valid invoices found in the ZIP file. Please ensure it contains XML invoice files.',
                );
            }

            const results: ImportedInvoiceResult[] = [];

            // Step 2: Process each invoice entry
            for (const entry of entries) {
                if (!entry.invoice) {
                    results.push({
                        success: false,
                        invoiceNumber: entry.fileName,
                        error: entry.parseError || 'Failed to parse invoice',
                        documentsUploaded: 0,
                    });
                    continue;
                }

                try {
                    const result = await processInvoiceEntry(
                        entry,
                        creditAccountId,
                        debitAccountId,
                    );
                    results.push(result);
                } catch (error) {
                    results.push({
                        success: false,
                        invoiceNumber: entry.invoice.invoiceNumber,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                        documentsUploaded: 0,
                    });
                }
            }

            return results;
        },
        onSuccess: (results) => {
            const successCount = results.filter((r) => r.success).length;
            const errorCount = results.filter((r) => !r.success).length;

            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });

            if (successCount > 0 && errorCount === 0) {
                toast.success(
                    `Successfully imported ${successCount} invoice${successCount > 1 ? 's' : ''}.`,
                );
            } else if (successCount > 0 && errorCount > 0) {
                toast.warning(
                    `Imported ${successCount} invoice${successCount > 1 ? 's' : ''}, ${errorCount} failed.`,
                );
            } else {
                toast.error('Failed to import any invoices.');
            }

            // Open the first successfully created transaction
            const firstSuccess = results.find(
                (r) => r.success && r.transactionId,
            );
            if (firstSuccess?.transactionId && onOpen) {
                onOpen(firstSuccess.transactionId, 'documents');
            }

            if (onComplete) {
                onComplete();
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to import invoices from ZIP.');
        },
    });

    return mutation;
};

/**
 * Process a single invoice entry: create transaction and upload attachments
 */
async function processInvoiceEntry(
    entry: ZipInvoiceEntry,
    creditAccountId: string | undefined,
    debitAccountId: string | undefined,
): Promise<ImportedInvoiceResult> {
    if (!entry.invoice) {
        return {
            success: false,
            invoiceNumber: entry.fileName,
            error: 'No invoice data found',
            documentsUploaded: 0,
        };
    }

    const invoice = entry.invoice;

    // Create the transaction
    const amount = convertAmountToMiliunits(invoice.totalAmount);

    // Build notes from invoice data
    const noteParts: string[] = [];
    if (invoice.invoiceNumber) {
        noteParts.push(`Invoice #${invoice.invoiceNumber}`);
    }
    if (invoice.supplierName) {
        noteParts.push(`From: ${invoice.supplierName}`);
    }
    if (invoice.payeeIban) {
        noteParts.push(`IBAN: ${invoice.payeeIban}`);
    }
    if (invoice.paymentReference) {
        noteParts.push(`Ref: ${invoice.paymentReference}`);
    }
    if (invoice.notes) {
        noteParts.push(invoice.notes);
    }

    // Create transaction
    const transactionResponse = await client.api.transactions.$post({
        json: {
            date: invoice.issueDate,
            payee: invoice.supplierName || undefined,
            notes: noteParts.join(' | ') || undefined,
            creditAccountId: creditAccountId || undefined,
            debitAccountId: debitAccountId || undefined,
            amount,
            status: 'draft',
        },
    });

    if (!transactionResponse.ok) {
        const error = await transactionResponse.json();
        throw new Error(
            (error as { error?: string }).error ||
                'Failed to create transaction.',
        );
    }

    const transactionData = await transactionResponse.json();
    const transactionId = transactionData.data.id;

    // Upload attachments
    let documentsUploaded = 0;

    if (entry.attachments.length > 0) {
        // Get document types
        const docTypesResponse = await client.api['document-types'].$get();
        let defaultDocTypeId: string | undefined;

        if (docTypesResponse.ok) {
            const { data: docTypes } = await docTypesResponse.json();
            // Try to find "Invoice" type, or use first available
            const invoiceType = docTypes.find(
                (t) =>
                    t.name.toLowerCase().includes('invoice') ||
                    t.name.toLowerCase().includes('receipt'),
            );
            defaultDocTypeId = invoiceType?.id || docTypes[0]?.id;
        }

        if (defaultDocTypeId) {
            for (const attachment of entry.attachments) {
                try {
                    // Create File object from Blob
                    const file = new File(
                        [attachment.data],
                        attachment.fileName,
                        {
                            type: attachment.mimeType,
                        },
                    );

                    // Generate upload URL
                    const uploadUrlResponse = await client.api.documents[
                        'generate-upload-url'
                    ].$post({
                        json: {
                            transactionId,
                            fileName: attachment.fileName,
                        },
                    });

                    if (!uploadUrlResponse.ok) {
                        console.error(
                            'Failed to generate upload URL for',
                            attachment.fileName,
                        );
                        continue;
                    }

                    const { data: uploadData } = await uploadUrlResponse.json();
                    const { uploadUrl } = uploadData;

                    // Extract storage path from SAS URL
                    const url = new URL(uploadUrl);
                    const storagePath = url.pathname.substring(
                        url.pathname.indexOf('/documents/') +
                            '/documents/'.length,
                    );

                    // Upload to blob storage
                    const uploadResponse = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'x-ms-blob-type': 'BlockBlob',
                            'Content-Type': attachment.mimeType,
                        },
                        body: file,
                    });

                    if (!uploadResponse.ok) {
                        console.error(
                            'Failed to upload to blob storage:',
                            attachment.fileName,
                        );
                        continue;
                    }

                    // Save document metadata
                    const saveResponse = await client.api.documents.$post({
                        json: {
                            transactionId,
                            documentTypeId: defaultDocTypeId,
                            fileName: attachment.fileName,
                            fileSize: file.size,
                            mimeType: attachment.mimeType,
                            storagePath,
                        },
                    });

                    if (saveResponse.ok) {
                        documentsUploaded++;
                    }
                } catch (error) {
                    console.error(
                        'Error uploading attachment:',
                        attachment.fileName,
                        error,
                    );
                }
            }
        }
    }

    return {
        success: true,
        transactionId,
        invoiceNumber: invoice.invoiceNumber,
        documentsUploaded,
    };
}
