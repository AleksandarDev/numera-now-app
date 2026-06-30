import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/hono';
import {
    type ParsedInvoice,
    parseInvoiceZip,
    type ZipInvoiceEntry,
} from '@/lib/invoice-xml-parser';
import { convertAmountToMiliunits } from '@/lib/utils';

type ImportedInvoiceOutcome = 'created' | 'updated' | 'skipped' | 'failed';

export interface ImportedInvoiceResult {
    success: boolean;
    outcome: ImportedInvoiceOutcome;
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
                        outcome: 'failed',
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
                        outcome: 'failed',
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
            const importedCount = results.filter((result) =>
                ['created', 'updated'].includes(result.outcome),
            ).length;
            const skippedCount = results.filter(
                (result) => result.outcome === 'skipped',
            ).length;
            const errorCount = results.filter(
                (result) => result.outcome === 'failed',
            ).length;

            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });

            if (importedCount > 0 && errorCount === 0) {
                toast.success(
                    `Imported ${importedCount} invoice${importedCount > 1 ? 's' : ''}${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}.`,
                );
            } else if (importedCount > 0 && errorCount > 0) {
                toast.warning(
                    `Imported ${importedCount} invoice${importedCount > 1 ? 's' : ''}, ${errorCount} failed.`,
                );
            } else if (skippedCount > 0 && errorCount === 0) {
                toast.info(`Skipped ${skippedCount} matching invoice import.`);
            } else {
                toast.error('Failed to import any invoices.');
            }

            // Open the first successfully created transaction
            const firstSuccess = results.find(
                (result) => result.success && result.transactionId,
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
            outcome: 'failed',
            invoiceNumber: entry.fileName,
            error: 'No invoice data found',
            documentsUploaded: 0,
        };
    }

    const invoice = entry.invoice;
    const importedValues = buildImportedTransactionValues(
        invoice,
        creditAccountId,
        debitAccountId,
    );
    const matchingTransaction = await findMatchingTransaction(
        invoice.issueDate,
        importedValues.amount,
    );

    if (matchingTransaction) {
        const shouldUpdate = window.confirm(
            [
                `A transaction already exists for ${formatDateForQuery(invoice.issueDate)} with amount ${invoice.totalAmount.toFixed(2)}.`,
                '',
                'Update the existing transaction with invoice details and attach new documents?',
                '',
                'Choose Cancel to skip this invoice import.',
            ].join('\n'),
        );

        if (!shouldUpdate) {
            return {
                success: false,
                outcome: 'skipped',
                transactionId: matchingTransaction.id,
                invoiceNumber: invoice.invoiceNumber,
                documentsUploaded: 0,
            };
        }

        await updateMatchingTransaction(matchingTransaction, importedValues);
        const documentsUploaded = await uploadInvoiceAttachments(
            entry,
            matchingTransaction.id,
        );

        return {
            success: true,
            outcome: 'updated',
            transactionId: matchingTransaction.id,
            invoiceNumber: invoice.invoiceNumber,
            documentsUploaded,
        };
    }

    const transactionResponse = await client.api.transactions.$post({
        json: importedValues,
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

    const documentsUploaded = await uploadInvoiceAttachments(
        entry,
        transactionId,
    );

    return {
        success: true,
        outcome: 'created',
        transactionId,
        invoiceNumber: invoice.invoiceNumber,
        documentsUploaded,
    };
}

type ImportedTransactionValues = {
    date: Date;
    payee?: string;
    notes?: string;
    creditAccountId?: string;
    debitAccountId?: string;
    amount: number;
    status: 'draft';
};

type MatchingTransaction = {
    id: string;
    date: string | Date;
    payee?: string | null;
    payeeCustomerId?: string | null;
    notes?: string | null;
    accountId?: string | null;
    creditAccountId?: string | null;
    debitAccountId?: string | null;
    amount: number;
    status?: string | null;
    splitType?: string | null;
};

const buildImportedTransactionValues = (
    invoice: ParsedInvoice,
    creditAccountId: string | undefined,
    debitAccountId: string | undefined,
): ImportedTransactionValues => {
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

    return {
        date: invoice.issueDate,
        payee: invoice.supplierName || undefined,
        notes: noteParts.join(' | ') || undefined,
        creditAccountId: creditAccountId || undefined,
        debitAccountId: debitAccountId || undefined,
        amount: convertAmountToMiliunits(invoice.totalAmount),
        status: 'draft',
    };
};

const formatDateForQuery = (date: Date) => date.toISOString().slice(0, 10);

const findMatchingTransaction = async (
    date: Date,
    amount: number,
): Promise<MatchingTransaction | null> => {
    const dateQuery = formatDateForQuery(date);
    const response = await client.api.transactions.$get({
        query: {
            from: dateQuery,
            to: dateQuery,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to check for existing matching transactions.');
    }

    const { data } = await response.json();
    return (
        data.find(
            (transaction) =>
                transaction.splitType !== 'parent' &&
                Number(transaction.amount) === amount,
        ) ?? null
    );
};

const mergeNotes = (
    existingNotes?: string | null,
    importedNotes?: string | null,
) => {
    if (!importedNotes) {
        return existingNotes || undefined;
    }

    if (!existingNotes) {
        return importedNotes;
    }

    return existingNotes.includes(importedNotes)
        ? existingNotes
        : `${existingNotes} | ${importedNotes}`;
};

const updateMatchingTransaction = async (
    transaction: MatchingTransaction,
    importedValues: ImportedTransactionValues,
) => {
    const canUpdateAccounts =
        transaction.status !== 'completed' &&
        transaction.status !== 'reconciled';
    const response = await client.api.transactions[':id'].$patch({
        param: { id: transaction.id },
        json: {
            date: new Date(transaction.date),
            amount: transaction.amount,
            status: normalizeTransactionStatus(transaction.status),
            payeeCustomerId: transaction.payeeCustomerId ?? undefined,
            payee: transaction.payee || importedValues.payee,
            notes: mergeNotes(transaction.notes, importedValues.notes),
            accountId: transaction.accountId ?? undefined,
            creditAccountId:
                transaction.creditAccountId ||
                (canUpdateAccounts
                    ? importedValues.creditAccountId
                    : undefined),
            debitAccountId:
                transaction.debitAccountId ||
                (canUpdateAccounts ? importedValues.debitAccountId : undefined),
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(
            (error as { error?: string }).error ||
                'Failed to update existing transaction.',
        );
    }
};

const normalizeTransactionStatus = (
    status?: string | null,
): 'draft' | 'pending' | 'completed' | 'reconciled' => {
    if (
        status === 'draft' ||
        status === 'pending' ||
        status === 'completed' ||
        status === 'reconciled'
    ) {
        return status;
    }

    return 'draft';
};

const getDocumentKey = (fileName: string, fileSize: number) =>
    `${fileName}:${fileSize}`;

const getExistingDocumentKeys = async (transactionId: string) => {
    const response = await client.api.documents.transaction[
        ':transactionId'
    ].$get({
        param: { transactionId },
    });

    if (!response.ok) {
        return new Set<string>();
    }

    const { data } = await response.json();
    return new Set(
        data.map((document) =>
            getDocumentKey(document.fileName, document.fileSize),
        ),
    );
};

const uploadInvoiceAttachments = async (
    entry: ZipInvoiceEntry,
    transactionId: string,
) => {
    let documentsUploaded = 0;

    if (entry.attachments.length > 0) {
        const existingDocumentKeys =
            await getExistingDocumentKeys(transactionId);
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
                    const documentKey = getDocumentKey(
                        attachment.fileName,
                        attachment.data.size,
                    );
                    if (existingDocumentKeys.has(documentKey)) {
                        continue;
                    }

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
                        existingDocumentKeys.add(documentKey);
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

    return documentsUploaded;
};
