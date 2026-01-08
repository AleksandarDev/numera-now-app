import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { aliasedTable, and, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { accounts, documents, documentTypes, transactions } from '@/db/schema';
import {
    generateDownloadUrl,
    generateUploadUrl,
    verifyStoragePathOwnership,
} from '@/lib/azure-storage';

const getAuthorizedTransaction = async (
    transactionId: string,
    userId: string,
) => {
    const creditAccounts = aliasedTable(accounts, 'creditAccounts');
    const debitAccounts = aliasedTable(accounts, 'debitAccounts');

    const [transaction] = await db
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
            ),
        );

    return transaction;
};

const app = new Hono()
    // Get all documents for a transaction
    .get('/transaction/:transactionId', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { transactionId } = ctx.req.param();

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
            })
            .from(documents)
            .leftJoin(
                documentTypes,
                eq(documents.documentTypeId, documentTypes.id),
            )
            .where(
                and(
                    eq(documents.transactionId, transactionId),
                    eq(documents.isDeleted, false),
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
                documentTypeId: z.string(),
                fileName: z.string(),
                fileSize: z.number(),
                mimeType: z.string(),
                storagePath: z.string(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const {
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

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            const [doc] = await db
                .select({
                    storagePath: documents.storagePath,
                    fileName: documents.fileName,
                    transactionId: documents.transactionId,
                })
                .from(documents)
                .where(eq(documents.id, id));

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            // Verify ownership through transaction
            const transaction = await getAuthorizedTransaction(
                doc.transactionId,
                auth.userId,
            );

            if (!transaction) {
                return ctx.json({ error: 'Unauthorized.' }, 403);
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
                const [doc] = await db
                    .select({
                        transactionId: documents.transactionId,
                    })
                    .from(documents)
                    .where(eq(documents.id, id));

                if (!doc) {
                    return ctx.json({ error: 'Document not found.' }, 404);
                }

                // Verify ownership through transaction
                const transaction = await getAuthorizedTransaction(
                    doc.transactionId,
                    auth.userId,
                );

                if (!transaction) {
                    return ctx.json({ error: 'Unauthorized.' }, 403);
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
            const [doc] = await db
                .select({
                    storagePath: documents.storagePath,
                    transactionId: documents.transactionId,
                })
                .from(documents)
                .where(eq(documents.id, id));

            if (!doc) {
                return ctx.json({ error: 'Document not found.' }, 404);
            }

            // Verify ownership through transaction
            const transaction = await getAuthorizedTransaction(
                doc.transactionId,
                auth.userId,
            );

            if (!transaction) {
                return ctx.json({ error: 'Unauthorized.' }, 403);
            }

            // Soft delete the document (retain blob to avoid inconsistency)
            await db
                .update(documents)
                .set({ isDeleted: true })
                .where(eq(documents.id, id));

            return ctx.json({ data: { id } });
        } catch (error) {
            console.error('Error deleting document:', error);
            return ctx.json({ error: 'Failed to delete document' }, 500);
        }
    });

export default app;
