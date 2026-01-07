import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { settings } from "@/db/schema";

const reconciliationConditionsSchema = z.array(
  z.enum(["hasReceipt", "isReviewed", "isApproved"])
);

const app = new Hono()
  .get("/", clerkMiddleware(), async (ctx) => {
    const auth = getAuth(ctx);

    if (!auth?.userId) {
      return ctx.json({ error: "Unauthorized." }, 401);
    }

    const [data] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, auth.userId));

    if (!data) {
      return ctx.json({
        data: {
          userId: auth.userId,
          doubleEntryMode: false,
          reconciliationConditions: [],
          minRequiredDocuments: 0,
          requiredDocumentTypeIds: [],
        },
      });
    }

    const parsed = {
      ...data,
      reconciliationConditions: JSON.parse(
        data.reconciliationConditions || '[]'
      ),
      requiredDocumentTypeIds: JSON.parse(
        data.requiredDocumentTypeIds || '[]'
      ),
    };

    return ctx.json({ data: parsed });
  })
  .patch(
    "/",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        doubleEntryMode: z.boolean().optional(),
        reconciliationConditions: reconciliationConditionsSchema.optional(),
        minRequiredDocuments: z.number().int().min(0).optional(),
        requiredDocumentTypeIds: z.array(z.string()).optional(),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const updateValues: {
        doubleEntryMode?: boolean;
        reconciliationConditions?: string;
        minRequiredDocuments?: number;
        requiredDocumentTypeIds?: string;
      } = {};

      if (values.doubleEntryMode !== undefined) {
        updateValues.doubleEntryMode = values.doubleEntryMode;
      }

      if (values.reconciliationConditions !== undefined) {
        updateValues.reconciliationConditions = JSON.stringify(values.reconciliationConditions);
      }

      if (values.minRequiredDocuments !== undefined) {
        updateValues.minRequiredDocuments = values.minRequiredDocuments;
      }

      if (values.requiredDocumentTypeIds !== undefined) {
        updateValues.requiredDocumentTypeIds = JSON.stringify(values.requiredDocumentTypeIds);
      }

      const [existingSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      let data;

      if (existingSettings) {
        [data] = await db
          .update(settings)
          .set(updateValues)
          .where(eq(settings.userId, auth.userId))
          .returning();
      } else {
        [data] = await db
          .insert(settings)
          .values({
            userId: auth.userId,
            doubleEntryMode: values.doubleEntryMode || false,
            reconciliationConditions: values.reconciliationConditions !== undefined
              ? JSON.stringify(values.reconciliationConditions)
              : '[]',
            minRequiredDocuments: values.minRequiredDocuments ?? 0,
            requiredDocumentTypeIds: values.requiredDocumentTypeIds !== undefined
              ? JSON.stringify(values.requiredDocumentTypeIds)
              : '[]',
          })
          .returning();
      }

      const parsed = {
        ...data,
        reconciliationConditions: JSON.parse(
          data.reconciliationConditions || '[]'
        ),
        requiredDocumentTypeIds: JSON.parse(
          data.requiredDocumentTypeIds || '[]'
        ),
      };

      return ctx.json({ data: parsed });
    }
  );

export default app;
