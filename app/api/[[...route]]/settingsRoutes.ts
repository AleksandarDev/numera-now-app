import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { settings, insertSettingsSchema } from "@/db/schema";

const app = new Hono()
  .get(
    "/",
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const [data] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      // Return default settings if none exist
      if (!data) {
        return ctx.json({ 
          data: { 
            userId: auth.userId, 
            doubleEntryMode: false 
          } 
        });
      }

      return ctx.json({ data });
    }
  )
  .patch(
    "/",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        doubleEntryMode: z.boolean(),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Check if settings exist
      const [existingSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      let data;

      if (existingSettings) {
        // Update existing settings
        [data] = await db
          .update(settings)
          .set(values)
          .where(eq(settings.userId, auth.userId))
          .returning();
      } else {
        // Insert new settings
        [data] = await db
          .insert(settings)
          .values({
            userId: auth.userId,
            ...values,
          })
          .returning();
      }

      return ctx.json({ data });
    }
  );

export default app;
