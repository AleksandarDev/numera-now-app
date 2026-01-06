import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { db } from "@/db/drizzle";
import {
  documents,
  documentTypes,
  insertDocumentSchema,
  transactions,
} from "@/db/schema";
import {
  uploadDocument,
  deleteDocument,
  generateDownloadUrl,
  generateUploadUrl,
  verifyStoragePathOwnership,
} from "@/lib/azure-storage";

const app = new Hono()
  // Get all documents for a transaction
  .get(
    "/transaction/:transactionId",
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { transactionId } = ctx.req.param();

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Verify transaction belongs to user
      const [transaction] = await db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(eq(transactions.id, transactionId));

      if (!transaction) {
        return ctx.json({ error: "Transaction not found." }, 404);
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
        .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
        .where(
          and(
            eq(documents.transactionId, transactionId),
            eq(documents.isDeleted, false)
          )
        );

      // Generate download URLs
      const documentsWithUrls = data.map((doc) => ({
        ...doc,
        downloadUrl: generateDownloadUrl(doc.storagePath),
      }));

      return ctx.json({ data: documentsWithUrls });
    }
  )

  // Get document types
  .get(
    "/types",
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const data = await db
        .select()
        .from(documentTypes)
        .where(eq(documentTypes.userId, auth.userId));

      return ctx.json({ data });
    }
  )

  // Get upload SAS URL for direct client upload
  .post(
    "/generate-upload-url",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        transactionId: z.string(),
        fileName: z.string(),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { transactionId, fileName } = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Verify transaction belongs to user
      const [transaction] = await db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(eq(transactions.id, transactionId));

      if (!transaction) {
        return ctx.json({ error: "Transaction not found." }, 404);
      }

      try {
        const uploadUrl = generateUploadUrl(
          auth.userId,
          transactionId,
          fileName,
          30 // 30 minutes expiration
        );

        return ctx.json({
          data: {
            uploadUrl,
            expiresIn: 30,
          },
        });
      } catch (error) {
        console.error("Error generating upload URL:", error);
        return ctx.json({ error: "Failed to generate upload URL" }, 500);
      }
    }
  )

  // Save document metadata (after upload)
  .post(
    "/",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        transactionId: z.string(),
        documentTypeId: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        storagePath: z.string(),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { transactionId, documentTypeId, fileName, fileSize, mimeType, storagePath } =
        ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Verify transaction belongs to user
      const [transaction] = await db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(eq(transactions.id, transactionId));

      if (!transaction) {
        return ctx.json({ error: "Transaction not found." }, 404);
      }

      // Verify document type belongs to user
      const [docType] = await db
        .select()
        .from(documentTypes)
        .where(
          and(
            eq(documentTypes.id, documentTypeId),
            eq(documentTypes.userId, auth.userId)
          )
        );

      if (!docType) {
        return ctx.json({ error: "Document type not found." }, 404);
      }

      // Verify storage path ownership
      if (!verifyStoragePathOwnership(storagePath, auth.userId)) {
        return ctx.json({ error: "Invalid storage path." }, 400);
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
        console.error("Error saving document metadata:", error);
        return ctx.json({ error: "Failed to save document" }, 500);
      }
    }
  )

  // Get download URL for a document
  .get(
    "/:id/download-url",
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.param();

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
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
          return ctx.json({ error: "Document not found." }, 404);
        }

        // Verify ownership through transaction
        const [transaction] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, doc.transactionId));

        if (!transaction) {
          return ctx.json({ error: "Unauthorized." }, 403);
        }

        const downloadUrl = generateDownloadUrl(doc.storagePath);

        return ctx.json({
          data: {
            downloadUrl,
            fileName: doc.fileName,
          },
        });
      } catch (error) {
        console.error("Error generating download URL:", error);
        return ctx.json({ error: "Failed to generate download URL" }, 500);
      }
    }
  )

  // Delete a document
  .delete(
    "/:id",
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.param();

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
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
          return ctx.json({ error: "Document not found." }, 404);
        }

        // Verify ownership through transaction
        const [transaction] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, doc.transactionId));

        if (!transaction) {
          return ctx.json({ error: "Unauthorized." }, 403);
        }

        // Soft delete the document
        await db
          .update(documents)
          .set({ isDeleted: true })
          .where(eq(documents.id, id));

        // Actually delete from Azure Storage
        await deleteDocument(doc.storagePath);

        return ctx.json({ data: { id } });
      } catch (error) {
        console.error("Error deleting document:", error);
        return ctx.json({ error: "Failed to delete document" }, 500);
      }
    }
  );

export default app;
