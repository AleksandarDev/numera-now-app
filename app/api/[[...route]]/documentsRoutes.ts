import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { aliasedTable, and, eq, inArray, isNull, or } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { accounts, documents, documentTypes, transactions } from '@/db/schema';
import { writeAuditEvent } from '@/lib/audit';
import {
    deleteDocument,
    generateDownloadUrl,
    generateStandaloneUploadUrl,
    generateUploadUrl,
    verifyStoragePathOwnership,
} from '@/lib/azure-storage';
import { categorizeDocument } from '@/lib/document-categorization';
import {
    createDocumentRestorePatch,
    createDocumentSoftDeletePatch,
    DOCUMENT_SOFT_DELETE_BLOB_POLICY,
} from '@/lib/document-lifecycle';
import { listDocuments } from '@/lib/services/finance-entities';

const getAuthorizedTransaction = async (
    transactionId: string,
    userId: string,
) => {
    const creditAccounts = aliasedTable(accounts, 'creditAccounts');
    const debitAccounts = aliasedTable(accounts, 'debitAccounts');

    const [transaction] = await db
        .select({
            id: transactions.id,
            splitGroupId: transactions.splitGroupId,
        })
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
                ),
                isNull(transactions.deletedAt),
            ),
        );

    return transaction;
};

const getDocumentTransactionIds = async (
    transaction: NonNullable<
        Awaited<ReturnType<typeof getAuthorizedTransaction>>
    >,
    userId: string,
) => {
    if (!transaction.splitGroupId) {
        return [transaction.id];
    }

    const creditAccounts = aliasedTable(accounts, 'documentCreditAccounts');
    const debitAccounts = aliasedTable(accounts, 'documentDebitAccounts');

    const splitGroupMembers = await db
        .select({ id: transactions.id })
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
                eq(transactions.splitGroupId, transaction.splitGroupId),
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
                ),
                isNull(transactions.deletedAt),
            ),
        );

    return splitGroupMembers.length > 0
        ? splitGroupMembers.map((member) => member.id)
        : [transaction.id];
};

const documentLifecycleSchema = z.object({
    reason: z.string().max(500).optional(),
});

const documentPurgeSchema = documentLifecycleSchema.extend({
    confirm: z.literal(true),
});

const readJsonPayload = async (ctx: Context) => {
    const contentType = ctx.req.header('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return {};
    }

    try {
        return await ctx.req.json();
    } catch {
        return {};
    }
};

const readLifecycleReason = async (ctx: Context) => {
    const parsed = documentLifecycleSchema.safeParse(
        await readJsonPayload(ctx),
    );
    return parsed.success ? (parsed.data.reason ?? null) : null;
};

const readPurgePayload = async (ctx: Context) =>
    documentPurgeSchema.safeParse(await readJsonPayload(ctx));

const parseDeletedMode = (ctx: Context) => {
    const parsed = z
        .enum(['include', 'only'])
        .optional()
        .safeParse(ctx.req.query('deleted'));
    return parsed.success ? parsed.data : undefined;
};

const documentDeletedFilter = (deleted?: 'include' | 'only') => {
    if (deleted === 'include') {
        return undefined;
    }

    if (deleted === 'only') {
        return eq(documents.isDeleted, true);
    }

    return eq(documents.isDeleted, false);
};

const getAuthorizedDocument = async ({
    id,
    userId,
    deleted,
}: {
    id: string;
    userId: string;
    deleted?: 'include' | 'only';
}) => {
    const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), documentDeletedFilter(deleted)));

    if (!doc) {
        return null;
    }

    if (doc.uploadedBy === userId) {
        return doc;
    }

    if (doc.transactionId) {
        const transaction = await getAuthorizedTransaction(
            doc.transactionId,
            userId,
        );
        return transaction ? doc : null;
    }

    return null;
};

const writeDocumentAuditEvent = async ({
    action,
    userId,
    before,
    after,
    reason,
    source,
}: {
    action:
        | 'create'
        | 'update'
        | 'delete'
        | 'restore'
        | 'purge'
        | 'link'
        | 'unlink';
    userId: string;
    before?: typeof documents.$inferSelect | null;
    after?: typeof documents.$inferSelect | null;
    reason?: string | null;
    source: string;
}) => {
    const resource = after ?? before;
    if (!resource) return;

    await writeAuditEvent(db, {
        userId,
        actorUserId: userId,
        actorType: 'user',
        action,
        resourceType: 'document',
        resourceId: resource.id,
        resourceLabel: resource.fileName,
        before: before ?? null,
        after: after ?? null,
        sourceMetadata: {
            source,
            reason: reason ?? null,
            blobPolicy: DOCUMENT_SOFT_DELETE_BLOB_POLICY,
        },
    });
};

/**
 * Auto-categorize a document if documentTypeId is not provided.
 *
 * Analyzes the filename to detect common document patterns in Croatian and English,
 * then matches against the user's existing document types to auto-assign a category.
 *
 * @param documentTypeId - Optional document type ID. If provided, returns as-is.
 * @param fileName - The filename to analyze for categorization (e.g., "racun_2024.pdf")
 * @param userId - The user ID for fetching their document types
 * @returns The documentTypeId (either provided or auto-assigned)
 * @throws Object with error message and optional suggestion if categorization fails
 *
 * @example
 * // Returns existing documentTypeId if provided
 * await getOrAutoCategorizeDocumentType("existing-id", "file.pdf", "user123")
 * // Returns: "existing-id"
 *
 * @example
 * // Auto-categorizes based on filename
 * await getOrAutoCategorizeDocumentType(undefined, "racun_2024.pdf", "user123")
 * // Returns: "invoice-doc-type-id" (if user has an Invoice type)
 */
const getOrAutoCategorizeDocumentType = async (
    documentTypeId: string | undefined,
    fileName: string,
    userId: string,
): Promise<string> => {
    if (documentTypeId) {
        return documentTypeId;
    }

    // Fetch user's document types for categorization
    const userDocTypes = await db
        .select()
        .from(documentTypes)
        .where(eq(documentTypes.userId, userId));

    const categorization = categorizeDocument(fileName, userDocTypes);

    if (categorization.documentTypeId) {
        return categorization.documentTypeId;
    }

    // No match found - throw error object with suggestion
    throw {
        error: 'Document type is required. Could not auto-categorize document.',
        suggestion: categorization.suggestedTypeName,
    };
};

const app = new Hono()
    // Get all documents (with filters)
    .get(
        '/',
        clerkMiddleware(),
        zValidator(
            'query',
            z.object({
                documentTypeId: z.string().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                unattached: z.string().optional(),
                deleted: z.enum(['include', 'only']).optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { documentTypeId, from, to, unattached, deleted } =
                ctx.req.valid('query');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const documentsWithUrls = await listDocuments({
                userId: auth.userId,
                documentTypeId,
                from,
                to,
                unattached: unattached === 'true',
                deleted,
            });

            return ctx.json({ data: documentsWithUrls });
        },
    )
    // Get all documents for a transaction
    .get('/transaction/:transactionId', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { transactionId } = ctx.req.param();
        const deleted = parseDeletedMode(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        // Verify transaction belongs to user
        const transaction = await getAuthorizedTransaction(
            transactionId,
            auth.userId,
        );

        if (!transaction) {
            return ctx.json({ error: 'Transaction not found.' }, 404);
        }

        const documentTransactionIds = await getDocumentTransactionIds(
            transaction,
            auth.userId,
        );
        const data = await db
            .select({
                id: documents.id,
                fileName: documents.fileName,
                fileSize: documents.fileSize,
                mimeType: documents.mimeType,
                documentTypeId: documents.documentTypeId,
                documentTypeName: documentTypes.name,
                uploadedBy: documents.uploadedBy,
                uploadedAt: documents.uploadedAt,
                storagePath: documents.storagePath,
                isDeleted: documents.isDeleted,
                deletedAt: documents.deletedAt,
                deletedBy: documents.deletedBy,
                deleteReason: documents.deleteReason,
                restoredAt: documents.restoredAt,
                restoredBy: documents.restoredBy,
                restoreReason: documents.restoreReason,
            })
            .from(documents)
            .leftJoin(
                documentTypes,
                eq(documents.documentTypeId, documentTypes.id),
            )
            .where(
                and(
                    inArray(documents.transactionId, documentTransactionIds),
                    documentDeletedFilter(deleted),
                ),
            );

        // Generate download URLs
        const documentsWithUrls = data.map((doc) => ({
            ...doc,
            downloadUrl: generateDownloadUrl(doc.storagePath),
        }));

        return ctx.json({ data: documentsWithUrls });
    })

    // Get document types
    .get('/types', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const data = await db
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.userId, auth.userId));

        return ctx.json({ data });
    })

    // Get upload SAS URL for direct client upload
    .post(
        '/generate-upload-url',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                transactionId: z.string(),
                fileName: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { transactionId, fileName } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Verify transaction belongs to user
            const transaction = await getAuthorizedTransaction(
                transactionId,
                auth.userId,
            );

            if (!transaction) {
                return ctx.json({ error: 'Transaction not found.' }, 404);
            }

            try {
                const uploadUrl = generateUploadUrl(
                    auth.userId,
                    transactionId,
                    fileName,
                    30, // 30 minutes expiration
                );

                return ctx.json({
                    data: {
                        uploadUrl,
                        expiresIn: 30,
                    },
                });
            } catch (error) {
                console.error('Error generating upload URL:', error);
                return ctx.json(
                    { error: 'Failed to generate upload URL' },
                    500,
                );
            }
        },
    )

    // Save document metadata (after upload)
    .post(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                transactionId: z.string(),
                documentTypeId: z.string().optional(),
                fileName: z.string(),
                fileSize: z.number(),
                mimeType: z.string(),
                storagePath: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            let {
                transactionId,
                documentTypeId,
                fileName,
                fileSize,
                mimeType,
                storagePath,
            } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Verify transaction belongs to user
            const transaction = await getAuthorizedTransaction(
                transactionId,
                auth.userId,
            );

            if (!transaction) {
                return ctx.json({ error: 'Transaction not found.' }, 404);
            }

            // Auto-categorize if documentTypeId not provided
            try {
                documentTypeId = await getOrAutoCategorizeDocumentType(
                    documentTypeId,
                    fileName,
                    auth.userId,
                );
            } catch (err: unknown) {
                return ctx.json(err as Record<string, unknown>, 400);
            }

            // Verify document type belongs to user
            const [docType] = await db
                .select()
                .from(documentTypes)
                .where(
                    and(
                        eq(documentTypes.id, documentTypeId),
                        eq(documentTypes.userId, auth.userId),
                    ),
                );

            if (!docType) {
                return ctx.json({ error: 'Document type not found.' }, 404);
            }

            // Verify storage path ownership
            if (!verifyStoragePathOwnership(storagePath, auth.userId)) {
                return ctx.json({ error: 'Invalid storage path.' }, 400);
            }

            try {
                const [data] = await db
                    .insert(documents)
                    .values({
                        id: createId(),
                        transactionId,
                        documentTypeId,
                        fileName,
                        fileSize,
                        mimeType,
                        storagePath,
                        uploadedBy: auth.userId,
                    })
                    .returning();

                await writeDocumentAuditEvent({
                    action: 'create',
                    userId: auth.userId,
                    after: data,
                    source: 'documents_upload',
                });

                return ctx.json({ data }, 201);
            } catch (error) {
                console.error('Error saving document metadata:', error);
                return ctx.json({ error: 'Failed to save document' }, 500);
            }
        },
    )

    // Get download URL for a document
    .get('/:id/download-url', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { id } = ctx.req.param();
        const deleted = parseDeletedMode(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            const doc = await getAuthorizedDocument({
                id,
                userId: auth.userId,
                deleted,
            });

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            const downloadUrl = generateDownloadUrl(doc.storagePath);

            return ctx.json({
                data: {
                    downloadUrl,
                    fileName: doc.fileName,
                },
            });
        } catch (error) {
            console.error('Error generating download URL:', error);
            return ctx.json({ error: 'Failed to generate download URL' }, 500);
        }
    })

    // Update document metadata (e.g., change document type)
    .patch(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                documentTypeId: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.param();
            const { documentTypeId } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            try {
                const doc = await getAuthorizedDocument({
                    id,
                    userId: auth.userId,
                });

                if (!doc) {
                    return ctx.json({ error: 'Document not found.' }, 404);
                }

                // If updating document type, verify it belongs to user
                if (documentTypeId) {
                    const [docType] = await db
                        .select()
                        .from(documentTypes)
                        .where(
                            and(
                                eq(documentTypes.id, documentTypeId),
                                eq(documentTypes.userId, auth.userId),
                            ),
                        );

                    if (!docType) {
                        return ctx.json(
                            { error: 'Document type not found.' },
                            404,
                        );
                    }
                }

                const updateData: { documentTypeId?: string } = {};
                if (documentTypeId) updateData.documentTypeId = documentTypeId;

                const [updatedDoc] = await db
                    .update(documents)
                    .set(updateData)
                    .where(eq(documents.id, id))
                    .returning();

                await writeDocumentAuditEvent({
                    action: 'update',
                    userId: auth.userId,
                    before: doc,
                    after: updatedDoc,
                    source: 'documents_update',
                });

                return ctx.json({ data: updatedDoc });
            } catch (error) {
                console.error('Error updating document:', error);
                return ctx.json({ error: 'Failed to update document' }, 500);
            }
        },
    )

    // Delete a document
    .delete('/:id', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { id } = ctx.req.param();

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            const doc = await getAuthorizedDocument({
                id,
                userId: auth.userId,
            });

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            const reason = await readLifecycleReason(ctx);

            // Soft delete the document (retain blob to avoid inconsistency)
            const [updatedDoc] = await db
                .update(documents)
                .set(
                    createDocumentSoftDeletePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(documents.id, id))
                .returning();

            await writeDocumentAuditEvent({
                action: 'delete',
                userId: auth.userId,
                before: doc,
                after: updatedDoc,
                reason,
                source: 'documents_delete',
            });

            return ctx.json({ data: updatedDoc });
        } catch (error) {
            console.error('Error deleting document:', error);
            return ctx.json({ error: 'Failed to delete document' }, 500);
        }
    })

    // Restore a deleted document
    .post('/:id/restore', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { id } = ctx.req.param();

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            const doc = await getAuthorizedDocument({
                id,
                userId: auth.userId,
                deleted: 'only',
            });

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            const reason = await readLifecycleReason(ctx);
            const [updatedDoc] = await db
                .update(documents)
                .set(
                    createDocumentRestorePatch({
                        userId: auth.userId,
                        reason,
                    }),
                )
                .where(eq(documents.id, id))
                .returning();

            await writeDocumentAuditEvent({
                action: 'restore',
                userId: auth.userId,
                before: doc,
                after: updatedDoc,
                reason,
                source: 'documents_restore',
            });

            return ctx.json({ data: updatedDoc });
        } catch (error) {
            console.error('Error restoring document:', error);
            return ctx.json({ error: 'Failed to restore document' }, 500);
        }
    })

    // Permanently purge a deleted document and its blob
    .post('/:id/purge', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { id } = ctx.req.param();

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            const parsedPayload = await readPurgePayload(ctx);
            if (!parsedPayload.success) {
                return ctx.json(
                    { error: 'Permanent purge requires confirm: true.' },
                    400,
                );
            }

            const doc = await getAuthorizedDocument({
                id,
                userId: auth.userId,
                deleted: 'only',
            });

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            await deleteDocument(doc.storagePath);

            const [purgedDoc] = await db
                .delete(documents)
                .where(eq(documents.id, id))
                .returning();

            await writeDocumentAuditEvent({
                action: 'purge',
                userId: auth.userId,
                before: doc,
                after: null,
                reason: parsedPayload.data.reason ?? null,
                source: 'documents_purge',
            });

            return ctx.json({ data: purgedDoc });
        } catch (error) {
            console.error('Error purging document:', error);
            return ctx.json({ error: 'Failed to purge document' }, 500);
        }
    })

    // Generate upload URL for standalone document (no transaction)
    .post(
        '/generate-standalone-upload-url',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                fileName: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { fileName } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            try {
                const { uploadUrl, storagePath } = generateStandaloneUploadUrl(
                    auth.userId,
                    fileName,
                    30, // 30 minutes expiration
                );

                return ctx.json({
                    data: {
                        uploadUrl,
                        storagePath,
                        expiresIn: 30,
                    },
                });
            } catch (error) {
                console.error('Error generating standalone upload URL:', error);
                return ctx.json(
                    { error: 'Failed to generate upload URL' },
                    500,
                );
            }
        },
    )

    // Save standalone document metadata (no transaction)
    .post(
        '/standalone',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                documentTypeId: z.string().optional(),
                fileName: z.string(),
                fileSize: z.number(),
                mimeType: z.string(),
                storagePath: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            let { documentTypeId, fileName, fileSize, mimeType, storagePath } =
                ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Auto-categorize if documentTypeId not provided
            try {
                documentTypeId = await getOrAutoCategorizeDocumentType(
                    documentTypeId,
                    fileName,
                    auth.userId,
                );
            } catch (err: unknown) {
                return ctx.json(err as Record<string, unknown>, 400);
            }

            // Verify document type belongs to user
            const [docType] = await db
                .select()
                .from(documentTypes)
                .where(
                    and(
                        eq(documentTypes.id, documentTypeId),
                        eq(documentTypes.userId, auth.userId),
                    ),
                );

            if (!docType) {
                return ctx.json({ error: 'Document type not found.' }, 404);
            }

            // Verify storage path ownership
            if (!verifyStoragePathOwnership(storagePath, auth.userId)) {
                return ctx.json({ error: 'Invalid storage path.' }, 400);
            }

            try {
                const [data] = await db
                    .insert(documents)
                    .values({
                        id: createId(),
                        transactionId: null,
                        documentTypeId,
                        fileName,
                        fileSize,
                        mimeType,
                        storagePath,
                        uploadedBy: auth.userId,
                    })
                    .returning();

                await writeDocumentAuditEvent({
                    action: 'create',
                    userId: auth.userId,
                    after: data,
                    source: 'documents_standalone_upload',
                });

                return ctx.json({ data }, 201);
            } catch (error) {
                console.error(
                    'Error saving standalone document metadata:',
                    error,
                );
                return ctx.json({ error: 'Failed to save document' }, 500);
            }
        },
    )

    // Link a document to a transaction
    .post(
        '/:id/link',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                transactionId: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const { transactionId } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            try {
                // Verify document exists and belongs to user
                const doc = await getAuthorizedDocument({
                    id,
                    userId: auth.userId,
                });

                if (!doc) {
                    return ctx.json({ error: 'Document not found.' }, 404);
                }

                if (doc.transactionId) {
                    return ctx.json(
                        {
                            error: 'Document is already attached to a transaction.',
                        },
                        400,
                    );
                }

                // Verify transaction belongs to user
                const transaction = await getAuthorizedTransaction(
                    transactionId,
                    auth.userId,
                );

                if (!transaction) {
                    return ctx.json({ error: 'Transaction not found.' }, 404);
                }

                // Link the document to the transaction
                const [updatedDoc] = await db
                    .update(documents)
                    .set({ transactionId })
                    .where(eq(documents.id, id))
                    .returning();

                await writeDocumentAuditEvent({
                    action: 'link',
                    userId: auth.userId,
                    before: doc,
                    after: updatedDoc,
                    source: 'documents_link',
                });

                return ctx.json({ data: updatedDoc });
            } catch (error) {
                console.error('Error linking document:', error);
                return ctx.json({ error: 'Failed to link document' }, 500);
            }
        },
    )

    // Unlink a document from its transaction
    .post(
        '/:id/unlink',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            try {
                const doc = await getAuthorizedDocument({
                    id,
                    userId: auth.userId,
                });

                if (!doc) {
                    return ctx.json({ error: 'Document not found.' }, 404);
                }

                if (!doc.transactionId) {
                    return ctx.json(
                        { error: 'Document is not attached to a transaction.' },
                        400,
                    );
                }

                const [updatedDoc] = await db
                    .update(documents)
                    .set({ transactionId: null })
                    .where(eq(documents.id, id))
                    .returning();

                await writeDocumentAuditEvent({
                    action: 'unlink',
                    userId: auth.userId,
                    before: doc,
                    after: updatedDoc,
                    source: 'documents_unlink',
                });

                return ctx.json({ data: updatedDoc });
            } catch (error) {
                console.error('Error unlinking document:', error);
                return ctx.json({ error: 'Failed to unlink document' }, 500);
            }
        },
    );

export default app;
