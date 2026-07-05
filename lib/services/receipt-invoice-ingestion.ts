import { UTCDate } from '@date-fns/utc';
import { createId } from '@paralleldrive/cuid2';
import { endOfDay, startOfDay } from 'date-fns';
import {
    aliasedTable,
    and,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    ne,
    or,
} from 'drizzle-orm';
import { db } from '../../db/drizzle.ts';
import {
    accounts,
    documents,
    documentTransactionLinks,
    documentTypes,
    settings,
    transactionStatusHistory,
    transactions,
} from '../../db/schema.ts';
import { validateDateNotInClosedPeriod } from '../accounting-periods.ts';
import { writeAuditEvent } from '../audit.ts';
import { verifyStoragePathOwnership } from '../azure-storage.ts';
import { buildExternalIngestAuditSourceMetadata } from '../external-ingest-controls.ts';
import { convertAmountToMiliunits } from '../utils.ts';

export type ReceiptInvoiceDocumentKind = 'invoice' | 'receipt';
export type ReceiptInvoiceTransactionMode =
    | 'createDraft'
    | 'attachToExisting'
    | 'matchOrCreateDraft';
export type ReceiptInvoiceMatchingStrategy =
    | 'none'
    | 'dateAmountCounterparty'
    | 'externalId';
export type ReceiptInvoiceTransactionStatus =
    | 'draft'
    | 'pending'
    | 'completed'
    | 'reconciled';

export type ReceiptInvoiceSourceContext = {
    source: string;
    actorUserId: string | null;
    actorType: 'user' | 'integration';
    apiKeyId?: string | null;
    sourceSystem?: string | null;
    externalId?: string | null;
    ingestEventId?: string | null;
    requestId?: string | null;
};

export type ReceiptInvoiceTransactionValues = {
    mode: ReceiptInvoiceTransactionMode;
    transactionId?: string | null;
    date: Date;
    amount: number;
    payee?: string | null;
    notes?: string | null;
    accountId?: string | null;
    creditAccountId?: string | null;
    debitAccountId?: string | null;
    status?: ReceiptInvoiceTransactionStatus;
    tagIds?: string[];
};

export type ReceiptInvoiceAttachment = {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    documentTypeId?: string | null;
};

export type ReceiptInvoiceIngestionInput = {
    userId: string;
    documentKind: ReceiptInvoiceDocumentKind;
    transaction: ReceiptInvoiceTransactionValues;
    matching?: {
        strategy?: ReceiptInvoiceMatchingStrategy;
    };
    attachments?: ReceiptInvoiceAttachment[];
    sourceContext: ReceiptInvoiceSourceContext;
};

export type ReceiptInvoiceMetadata = {
    invoiceNumber?: string | null;
    receiptNumber?: string | null;
    issueDate: Date;
    supplierName?: string | null;
    payeeIban?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
    totalAmount: number;
};

export type IngestionTransaction = {
    id: string;
    date: Date;
    amount: number;
    payee: string | null;
    notes: string | null;
    accountId: string | null;
    creditAccountId: string | null;
    debitAccountId: string | null;
    status: string;
    splitType?: string | null;
};

export type IngestionDocument = {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    documentTypeId: string;
};

export type IngestionAccount = {
    id: string;
    name: string;
    isReadOnly: boolean;
};

export type IngestionDocumentType = {
    id: string;
    name: string;
};

export type IngestionSettings = {
    doubleEntryMode: boolean;
};

export type ReceiptInvoiceIngestionPorts = {
    validateDateNotInClosedPeriod: (
        date: Date,
        userId: string,
    ) => Promise<string | null>;
    getSettings: (userId: string) => Promise<IngestionSettings | null>;
    getAccounts: (
        userId: string,
        accountIds: string[],
    ) => Promise<IngestionAccount[]>;
    findMatchingTransaction: (input: {
        userId: string;
        date: Date;
        amount: number;
        payee?: string | null;
        strategy: ReceiptInvoiceMatchingStrategy;
    }) => Promise<IngestionTransaction | null>;
    getTransaction: (input: {
        userId: string;
        transactionId: string;
    }) => Promise<IngestionTransaction | null>;
    createTransaction: (input: {
        userId: string;
        values: ReceiptInvoiceTransactionValues;
        sourceContext: ReceiptInvoiceSourceContext;
    }) => Promise<IngestionTransaction>;
    updateTransaction: (input: {
        userId: string;
        transaction: IngestionTransaction;
        values: Partial<ReceiptInvoiceTransactionValues>;
        sourceContext: ReceiptInvoiceSourceContext;
    }) => Promise<IngestionTransaction>;
    getDocumentTypes: (userId: string) => Promise<IngestionDocumentType[]>;
    getExistingDocumentKeys: (input: {
        userId: string;
        transactionId: string;
    }) => Promise<Set<string>>;
    createDocument: (input: {
        userId: string;
        transactionId: string;
        documentTypeId: string;
        attachment: ReceiptInvoiceAttachment;
        sourceContext: ReceiptInvoiceSourceContext;
    }) => Promise<IngestionDocument>;
    createDocumentLink: (input: {
        userId: string;
        documentId: string;
        transactionId: string;
        sourceContext: ReceiptInvoiceSourceContext;
    }) => Promise<void>;
};

export type ReceiptInvoiceIngestionResult =
    | {
          ok: true;
          data: {
              outcome: 'created' | 'updated' | 'attached';
              transaction: IngestionTransaction;
              documents: IngestionDocument[];
              skippedDuplicateDocuments: number;
          };
      }
    | {
          ok: false;
          status: 400 | 404;
          error: string;
      };

export const getDocumentKey = (fileName: string, fileSize: number) =>
    `${fileName}:${fileSize}`;

export const mergeIngestionNotes = (
    existingNotes?: string | null,
    importedNotes?: string | null,
) => {
    if (!importedNotes) {
        return existingNotes ?? null;
    }

    if (!existingNotes) {
        return importedNotes;
    }

    return existingNotes.includes(importedNotes)
        ? existingNotes
        : `${existingNotes} | ${importedNotes}`;
};

export const buildReceiptInvoiceTransactionValues = ({
    metadata,
    documentKind,
    creditAccountId,
    debitAccountId,
}: {
    metadata: ReceiptInvoiceMetadata;
    documentKind: ReceiptInvoiceDocumentKind;
    creditAccountId?: string | null;
    debitAccountId?: string | null;
}): ReceiptInvoiceTransactionValues => {
    const noteParts: string[] = [];
    const documentNumber =
        documentKind === 'invoice'
            ? metadata.invoiceNumber
            : metadata.receiptNumber;

    if (documentNumber) {
        noteParts.push(
            `${documentKind === 'invoice' ? 'Invoice' : 'Receipt'} #${documentNumber}`,
        );
    }
    if (metadata.supplierName) {
        noteParts.push(`From: ${metadata.supplierName}`);
    }
    if (metadata.payeeIban) {
        noteParts.push(`IBAN: ${metadata.payeeIban}`);
    }
    if (metadata.paymentReference) {
        noteParts.push(`Ref: ${metadata.paymentReference}`);
    }
    if (metadata.notes) {
        noteParts.push(metadata.notes);
    }

    return {
        mode: 'createDraft',
        date: metadata.issueDate,
        payee: metadata.supplierName ?? null,
        notes: noteParts.join(' | ') || null,
        creditAccountId: creditAccountId ?? null,
        debitAccountId: debitAccountId ?? null,
        amount: convertAmountToMiliunits(metadata.totalAmount),
        status: 'draft',
    };
};

const normalizeStatus = (status?: string | null) =>
    status === 'draft' ||
    status === 'pending' ||
    status === 'completed' ||
    status === 'reconciled'
        ? status
        : 'draft';

const getAccountIds = (values: ReceiptInvoiceTransactionValues) =>
    [
        values.accountId ?? null,
        values.creditAccountId ?? null,
        values.debitAccountId ?? null,
    ].filter(Boolean) as string[];

const validateTransactionForIngestion = async ({
    userId,
    values,
    ports,
}: {
    userId: string;
    values: ReceiptInvoiceTransactionValues;
    ports: ReceiptInvoiceIngestionPorts;
}): Promise<ReceiptInvoiceIngestionResult | null> => {
    const periodError = await ports.validateDateNotInClosedPeriod(
        values.date,
        userId,
    );
    if (periodError) {
        return {
            ok: false,
            status: 400,
            error: periodError,
        };
    }

    const status = normalizeStatus(values.status);
    const settings = await ports.getSettings(userId);
    if (
        settings?.doubleEntryMode &&
        status !== 'draft' &&
        (!values.creditAccountId || !values.debitAccountId)
    ) {
        return {
            ok: false,
            status: 400,
            error: 'Double-entry mode is enabled. Both credit and debit accounts are required.',
        };
    }

    if (values.accountId && (values.creditAccountId || values.debitAccountId)) {
        return {
            ok: false,
            status: 400,
            error: 'Use either accountId or creditAccountId/debitAccountId, not both.',
        };
    }

    if (values.amount < 0 && !values.accountId) {
        return {
            ok: false,
            status: 400,
            error: 'When using debit and credit accounts, amount must be positive or zero.',
        };
    }

    const uniqueAccountIds = [...new Set(getAccountIds(values))];
    if (uniqueAccountIds.length === 0) {
        return null;
    }

    const accountRows = await ports.getAccounts(userId, uniqueAccountIds);
    if (accountRows.length !== uniqueAccountIds.length) {
        const foundIds = new Set(accountRows.map((account) => account.id));
        const missingIds = uniqueAccountIds.filter((id) => !foundIds.has(id));
        return {
            ok: false,
            status: 400,
            error: `Account(s) not found or not owned by user: ${missingIds.join(', ')}`,
        };
    }

    const readOnlyAccounts = accountRows.filter(
        (account) => account.isReadOnly,
    );
    if (readOnlyAccounts.length > 0) {
        return {
            ok: false,
            status: 400,
            error: `Cannot use read-only account(s) in transactions: ${readOnlyAccounts.map((account) => account.name).join(', ')}`,
        };
    }

    return null;
};

const resolveDocumentTypeId = ({
    attachment,
    documentKind,
    documentTypes,
}: {
    attachment: ReceiptInvoiceAttachment;
    documentKind: ReceiptInvoiceDocumentKind;
    documentTypes: IngestionDocumentType[];
}) => {
    if (attachment.documentTypeId) {
        return documentTypes.some(
            (type) => type.id === attachment.documentTypeId,
        )
            ? attachment.documentTypeId
            : null;
    }

    const matchingType = documentTypes.find((type) =>
        type.name.toLowerCase().includes(documentKind),
    );
    return matchingType?.id ?? documentTypes[0]?.id ?? null;
};

const attachDocuments = async ({
    input,
    transactionId,
    ports,
}: {
    input: ReceiptInvoiceIngestionInput;
    transactionId: string;
    ports: ReceiptInvoiceIngestionPorts;
}) => {
    const attachments = input.attachments ?? [];
    if (attachments.length === 0) {
        return {
            ok: true as const,
            documents: [] as IngestionDocument[],
            skippedDuplicateDocuments: 0,
        };
    }

    const documentTypes = await ports.getDocumentTypes(input.userId);
    const existingKeys = await ports.getExistingDocumentKeys({
        userId: input.userId,
        transactionId,
    });
    const createdDocuments: IngestionDocument[] = [];
    let skippedDuplicateDocuments = 0;

    for (const attachment of attachments) {
        const documentKey = getDocumentKey(
            attachment.fileName,
            attachment.fileSize,
        );
        if (existingKeys.has(documentKey)) {
            skippedDuplicateDocuments++;
            continue;
        }

        if (!verifyStoragePathOwnership(attachment.storagePath, input.userId)) {
            return {
                ok: false as const,
                status: 400 as const,
                error: 'Invalid storage path.',
            };
        }

        const documentTypeId = resolveDocumentTypeId({
            attachment,
            documentKind: input.documentKind,
            documentTypes,
        });
        if (!documentTypeId) {
            return {
                ok: false as const,
                status: 400 as const,
                error: 'Document type not found.',
            };
        }

        const document = await ports.createDocument({
            userId: input.userId,
            transactionId,
            documentTypeId,
            attachment,
            sourceContext: input.sourceContext,
        });
        await ports.createDocumentLink({
            userId: input.userId,
            documentId: document.id,
            transactionId,
            sourceContext: input.sourceContext,
        });
        createdDocuments.push(document);
        existingKeys.add(documentKey);
    }

    return {
        ok: true as const,
        documents: createdDocuments,
        skippedDuplicateDocuments,
    };
};

const getUpdateValuesForTransaction = (
    transaction: IngestionTransaction,
    values: ReceiptInvoiceTransactionValues,
): Partial<ReceiptInvoiceTransactionValues> => {
    const status = normalizeStatus(transaction.status);
    const canUpdateFinancialFields =
        status !== 'completed' && status !== 'reconciled';

    return {
        payee: transaction.payee || values.payee,
        notes: mergeIngestionNotes(transaction.notes, values.notes),
        ...(canUpdateFinancialFields
            ? {
                  date: values.date,
                  amount: values.amount,
                  accountId: transaction.accountId || values.accountId,
                  creditAccountId:
                      transaction.creditAccountId || values.creditAccountId,
                  debitAccountId:
                      transaction.debitAccountId || values.debitAccountId,
                  status,
              }
            : {}),
    };
};

export const ingestReceiptInvoice = async (
    input: ReceiptInvoiceIngestionInput,
    ports: ReceiptInvoiceIngestionPorts = defaultReceiptInvoiceIngestionPorts,
): Promise<ReceiptInvoiceIngestionResult> => {
    const mode = input.transaction.mode;
    let transaction: IngestionTransaction;
    let outcome: 'created' | 'updated' | 'attached';

    if (mode === 'attachToExisting') {
        if (!input.transaction.transactionId) {
            return {
                ok: false,
                status: 400,
                error: 'transactionId is required for attachToExisting mode.',
            };
        }

        const existingTransaction = await ports.getTransaction({
            userId: input.userId,
            transactionId: input.transaction.transactionId,
        });
        if (!existingTransaction) {
            return {
                ok: false,
                status: 404,
                error: 'Transaction not found.',
            };
        }

        transaction = existingTransaction;
        outcome = 'attached';
    } else {
        const validation = await validateTransactionForIngestion({
            userId: input.userId,
            values: input.transaction,
            ports,
        });
        if (validation) {
            return validation;
        }

        const matchingStrategy = input.matching?.strategy ?? 'none';
        const matchingTransaction =
            mode === 'matchOrCreateDraft' && matchingStrategy !== 'none'
                ? await ports.findMatchingTransaction({
                      userId: input.userId,
                      date: input.transaction.date,
                      amount: input.transaction.amount,
                      payee: input.transaction.payee,
                      strategy: matchingStrategy,
                  })
                : null;

        if (matchingTransaction) {
            transaction = await ports.updateTransaction({
                userId: input.userId,
                transaction: matchingTransaction,
                values: getUpdateValuesForTransaction(
                    matchingTransaction,
                    input.transaction,
                ),
                sourceContext: input.sourceContext,
            });
            outcome = 'updated';
        } else {
            transaction = await ports.createTransaction({
                userId: input.userId,
                values: {
                    ...input.transaction,
                    status: 'draft',
                },
                sourceContext: input.sourceContext,
            });
            outcome = 'created';
        }
    }

    const documentResult = await attachDocuments({
        input,
        transactionId: transaction.id,
        ports,
    });
    if (!documentResult.ok) {
        return documentResult;
    }

    return {
        ok: true,
        data: {
            outcome,
            transaction,
            documents: documentResult.documents,
            skippedDuplicateDocuments: documentResult.skippedDuplicateDocuments,
        },
    };
};

const createTransactionAccessFilter = (
    userId: string,
    creditAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
    debitAccounts: ReturnType<typeof aliasedTable<typeof accounts>>,
) =>
    or(
        eq(accounts.userId, userId),
        eq(creditAccounts.userId, userId),
        eq(debitAccounts.userId, userId),
        and(
            isNull(transactions.accountId),
            isNull(transactions.creditAccountId),
            isNull(transactions.debitAccountId),
            eq(transactions.statusChangedBy, userId),
        ),
    );

const toIngestionTransaction = (
    transaction: typeof transactions.$inferSelect,
): IngestionTransaction => ({
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    payee: transaction.payee,
    notes: transaction.notes,
    accountId: transaction.accountId,
    creditAccountId: transaction.creditAccountId,
    debitAccountId: transaction.debitAccountId,
    status: transaction.status,
    splitType: transaction.splitType,
});

const writeIngestionAuditEvent = async ({
    action,
    resourceType,
    resourceId,
    resourceLabel,
    before,
    after,
    sourceContext,
    userId,
}: {
    action: 'create' | 'update' | 'link';
    resourceType: 'transaction' | 'document';
    resourceId: string;
    resourceLabel?: string | null;
    before?: unknown;
    after?: unknown;
    sourceContext: ReceiptInvoiceSourceContext;
    userId: string;
}) =>
    writeAuditEvent(db, {
        userId,
        actorUserId: sourceContext.actorUserId,
        actorType: sourceContext.actorType,
        action,
        resourceType,
        resourceId,
        resourceLabel,
        before,
        after,
        sourceMetadata:
            sourceContext.actorType === 'integration'
                ? buildExternalIngestAuditSourceMetadata({
                      apiKeyId: sourceContext.apiKeyId,
                      sourceSystem: sourceContext.sourceSystem,
                      externalId: sourceContext.externalId,
                      ingestEventId: sourceContext.ingestEventId,
                      requestId: sourceContext.requestId,
                  })
                : {
                      source: sourceContext.source,
                      apiKeyId: sourceContext.apiKeyId ?? null,
                      sourceSystem: sourceContext.sourceSystem ?? null,
                      externalId: sourceContext.externalId ?? null,
                      ingestEventId: sourceContext.ingestEventId ?? null,
                      requestId: sourceContext.requestId ?? null,
                  },
        requestId: sourceContext.requestId ?? null,
    });

export const defaultReceiptInvoiceIngestionPorts: ReceiptInvoiceIngestionPorts =
    {
        validateDateNotInClosedPeriod,
        getSettings: async (userId) => {
            const [row] = await db
                .select({ doubleEntryMode: settings.doubleEntryMode })
                .from(settings)
                .where(eq(settings.userId, userId));
            return row ?? null;
        },
        getAccounts: async (userId, accountIds) => {
            if (accountIds.length === 0) {
                return [];
            }

            return db
                .select({
                    id: accounts.id,
                    name: accounts.name,
                    isReadOnly: accounts.isReadOnly,
                })
                .from(accounts)
                .where(
                    and(
                        eq(accounts.userId, userId),
                        inArray(accounts.id, accountIds),
                    ),
                );
        },
        findMatchingTransaction: async ({ userId, date, amount }) => {
            const creditAccounts = aliasedTable(accounts, 'creditAccounts');
            const debitAccounts = aliasedTable(accounts, 'debitAccounts');
            const [row] = await db
                .select({ transaction: transactions })
                .from(transactions)
                .leftJoin(accounts, eq(transactions.accountId, accounts.id))
                .leftJoin(
                    creditAccounts,
                    eq(transactions.creditAccountId, creditAccounts.id),
                )
                .leftJoin(
                    debitAccounts,
                    eq(transactions.debitAccountId, debitAccounts.id),
                )
                .where(
                    and(
                        createTransactionAccessFilter(
                            userId,
                            creditAccounts,
                            debitAccounts,
                        ),
                        isNull(transactions.deletedAt),
                        gte(transactions.date, startOfDay(date)),
                        lte(transactions.date, endOfDay(date)),
                        eq(transactions.amount, amount),
                        or(
                            isNull(transactions.splitType),
                            ne(transactions.splitType, 'parent'),
                        ),
                    ),
                )
                .limit(1);

            return row ? toIngestionTransaction(row.transaction) : null;
        },
        getTransaction: async ({ userId, transactionId }) => {
            const creditAccounts = aliasedTable(accounts, 'creditAccounts');
            const debitAccounts = aliasedTable(accounts, 'debitAccounts');
            const [row] = await db
                .select({ transaction: transactions })
                .from(transactions)
                .leftJoin(accounts, eq(transactions.accountId, accounts.id))
                .leftJoin(
                    creditAccounts,
                    eq(transactions.creditAccountId, creditAccounts.id),
                )
                .leftJoin(
                    debitAccounts,
                    eq(transactions.debitAccountId, debitAccounts.id),
                )
                .where(
                    and(
                        eq(transactions.id, transactionId),
                        createTransactionAccessFilter(
                            userId,
                            creditAccounts,
                            debitAccounts,
                        ),
                        isNull(transactions.deletedAt),
                    ),
                );

            return row ? toIngestionTransaction(row.transaction) : null;
        },
        createTransaction: async ({ userId, values, sourceContext }) => {
            const [created] = await db
                .insert(transactions)
                .values({
                    id: createId(),
                    date: values.date,
                    payee: values.payee || null,
                    notes: values.notes || null,
                    amount: values.amount,
                    accountId: values.accountId || null,
                    creditAccountId: values.creditAccountId || null,
                    debitAccountId: values.debitAccountId || null,
                    status: normalizeStatus(values.status),
                    statusChangedAt: new UTCDate(),
                    statusChangedBy: userId,
                })
                .returning();

            await db.insert(transactionStatusHistory).values({
                id: createId(),
                transactionId: created.id,
                fromStatus: null,
                toStatus: created.status,
                changedBy: userId,
                notes: 'Receipt/invoice ingestion created transaction',
            });

            await writeIngestionAuditEvent({
                action: 'create',
                resourceType: 'transaction',
                resourceId: created.id,
                resourceLabel: created.payee,
                after: created,
                sourceContext,
                userId,
            });

            return toIngestionTransaction(created);
        },
        updateTransaction: async ({
            userId,
            transaction,
            values,
            sourceContext,
        }) => {
            const nextStatus = values.status ?? transaction.status;
            const [before] = await db
                .select()
                .from(transactions)
                .where(eq(transactions.id, transaction.id));
            const updateValues: Partial<typeof transactions.$inferInsert> = {};

            if (values.date !== undefined) {
                updateValues.date = values.date;
            }
            if (values.payee !== undefined) {
                updateValues.payee = values.payee || null;
            }
            if (values.notes !== undefined) {
                updateValues.notes = values.notes || null;
            }
            if (values.amount !== undefined) {
                updateValues.amount = values.amount;
            }
            if (values.accountId !== undefined) {
                updateValues.accountId = values.accountId || null;
            }
            if (values.creditAccountId !== undefined) {
                updateValues.creditAccountId = values.creditAccountId || null;
            }
            if (values.debitAccountId !== undefined) {
                updateValues.debitAccountId = values.debitAccountId || null;
            }
            if (values.status !== undefined) {
                updateValues.status = nextStatus;
                if (nextStatus !== transaction.status) {
                    updateValues.statusChangedAt = new UTCDate();
                    updateValues.statusChangedBy = userId;
                }
            }

            const [updated] = await db
                .update(transactions)
                .set(updateValues)
                .where(eq(transactions.id, transaction.id))
                .returning();

            if (nextStatus !== transaction.status) {
                await db.insert(transactionStatusHistory).values({
                    id: createId(),
                    transactionId: updated.id,
                    fromStatus: transaction.status,
                    toStatus: nextStatus,
                    changedBy: userId,
                    notes: 'Receipt/invoice ingestion updated transaction',
                });
            }

            await writeIngestionAuditEvent({
                action: 'update',
                resourceType: 'transaction',
                resourceId: updated.id,
                resourceLabel: updated.payee,
                before,
                after: updated,
                sourceContext,
                userId,
            });

            return toIngestionTransaction(updated);
        },
        getDocumentTypes: async (userId) =>
            db
                .select({ id: documentTypes.id, name: documentTypes.name })
                .from(documentTypes)
                .where(eq(documentTypes.userId, userId)),
        getExistingDocumentKeys: async ({ transactionId }) => {
            const legacyDocuments = await db
                .select({
                    fileName: documents.fileName,
                    fileSize: documents.fileSize,
                })
                .from(documents)
                .where(
                    and(
                        eq(documents.transactionId, transactionId),
                        eq(documents.isDeleted, false),
                    ),
                );
            const linkedDocuments = await db
                .select({
                    fileName: documents.fileName,
                    fileSize: documents.fileSize,
                })
                .from(documentTransactionLinks)
                .innerJoin(
                    documents,
                    eq(documentTransactionLinks.documentId, documents.id),
                )
                .where(
                    and(
                        eq(
                            documentTransactionLinks.transactionId,
                            transactionId,
                        ),
                        eq(documents.isDeleted, false),
                    ),
                );

            return new Set(
                [...legacyDocuments, ...linkedDocuments].map((document) =>
                    getDocumentKey(document.fileName, document.fileSize),
                ),
            );
        },
        createDocument: async ({
            userId,
            transactionId,
            documentTypeId,
            attachment,
            sourceContext,
        }) => {
            const [created] = await db
                .insert(documents)
                .values({
                    id: createId(),
                    transactionId,
                    documentTypeId,
                    fileName: attachment.fileName,
                    fileSize: attachment.fileSize,
                    mimeType: attachment.mimeType,
                    storagePath: attachment.storagePath,
                    uploadedBy: userId,
                })
                .returning();

            await writeIngestionAuditEvent({
                action: 'create',
                resourceType: 'document',
                resourceId: created.id,
                resourceLabel: created.fileName,
                after: created,
                sourceContext,
                userId,
            });

            return {
                id: created.id,
                fileName: created.fileName,
                fileSize: created.fileSize,
                mimeType: created.mimeType,
                storagePath: created.storagePath,
                documentTypeId: created.documentTypeId,
            };
        },
        createDocumentLink: async ({
            userId,
            documentId,
            transactionId,
            sourceContext,
        }) => {
            await db
                .insert(documentTransactionLinks)
                .values({
                    id: createId(),
                    documentId,
                    transactionId,
                })
                .onConflictDoNothing({
                    target: [
                        documentTransactionLinks.documentId,
                        documentTransactionLinks.transactionId,
                    ],
                });

            await writeIngestionAuditEvent({
                action: 'link',
                resourceType: 'document',
                resourceId: documentId,
                sourceContext,
                userId,
            });
        },
    };
