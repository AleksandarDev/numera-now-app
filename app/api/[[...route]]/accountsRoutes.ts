import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/db/drizzle";
import { accounts, insertAccountSchema } from "@/db/schema";

const app = new Hono()
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        search: z.string().optional(),
        page: z.string().optional(),
        pageSize: z.string().optional(),
        accountId: z.string().optional(),
        showClosed: z.string().optional().transform((val) => val === "true"),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { page, pageSize, accountId, search, showClosed } = ctx.req.valid("query");
      if ((page && !Number.isInteger(Number(page))) ||
        (pageSize && !Number.isInteger(Number(pageSize)))) {
        return ctx.json({ error: "Invalid page or pageSize." }, 400);
      }

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Split keywords by space, group when in quotes
      const keywords = search?.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const searchAccountNameSql = keywords.map((keyword) =>
        or(
          ilike(accounts.name, `%${keyword.replace(/"/g, "")}%`),
          ilike(accounts.code, `%${keyword.replace(/"/g, "")}%`)
        )
      );

      const data = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          code: accounts.code,
          isOpen: accounts.isOpen,
          isReadOnly: accounts.isReadOnly,
          accountType: accounts.accountType,
        })
        .from(accounts)
        .where(and(
          and(...searchAccountNameSql),
          eq(accounts.userId, auth.userId),
          accountId ? eq(accounts.id, accountId) : undefined,
          // If showClosed is not explicitly true, only show open accounts
          showClosed ? undefined : eq(accounts.isOpen, true)))
        .offset(page ? Number(page) * Number(pageSize) : 0)
        .limit(pageSize ? Number(pageSize) : 10);

      // Add validation warnings for accounts with invalid configurations
      const dataWithValidation = data.map(account => {
        let hasInvalidConfig = false;

        // Check if account is open but any parent is closed
        if (account.isOpen && account.code && account.code.length > 1) {
          const parentCodes: string[] = [];
          for (let i = 1; i < account.code.length; i++) {
            parentCodes.push(account.code.substring(0, i));
          }

          // Check if any parent is closed (this would be invalid)
          const closedParents = data.filter(a =>
            a.code && parentCodes.includes(a.code) && !a.isOpen
          );

          hasInvalidConfig = closedParents.length > 0;
        }

        return {
          ...account,
          accountType: account.accountType,
          hasInvalidConfig
        };
      });

      return ctx.json({ data: dataWithValidation });
    })
  .get(
    "/:id",
    zValidator(
      "param",
      z.object({
        id: z.string().optional(),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");

      if (!id) {
        return ctx.json({ error: "Missing id." }, 400);
      }

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const [data] = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          code: accounts.code,
          isOpen: accounts.isOpen,
          isReadOnly: accounts.isReadOnly,
          accountType: accounts.accountType,
        })
        .from(accounts)
        .where(and(eq(accounts.userId, auth.userId), eq(accounts.id, id)));

      if (!data) {
        return ctx.json({ error: "Not found." }, 404);
      }

      return ctx.json({ data });
    }
  )
  .post(
    "/",
    clerkMiddleware(),
    zValidator(
      "json",
      insertAccountSchema.pick({
        name: true,
        code: true,
        isOpen: true,
        isReadOnly: true,
        accountType: true,
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const [data] = await db
        .insert(accounts)
        .values({
          id: createId(),
          userId: auth.userId,
          ...values,
        })
        .returning();

      return ctx.json({ data });
    }
  )
  .post(
    "/bulk-create",
    clerkMiddleware(),
    zValidator("json", z.array(insertAccountSchema.omit({ id: true, userId: true }))),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const data = await db
        .insert(accounts)
        .values(
          values.map((value) => ({
            id: createId(),
            userId: auth.userId,
            ...value,
          }))
        )
        .returning();

      return ctx.json({ data });
    }
  )
  .post(
    "/bulk-delete",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        ids: z.array(z.string()),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const data = await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.userId, auth.userId),
            inArray(accounts.id, values.ids)
          )
        )
        .returning({
          id: accounts.id,
        });

      return ctx.json({ data });
    }
  )
  .patch(
    "/:id",
    clerkMiddleware(),
    zValidator(
      "param",
      z.object({
        id: z.string().optional(),
      })
    ),
    zValidator(
      "json",
      insertAccountSchema.pick({
        name: true,
        code: true,
        isOpen: true,
        isReadOnly: true,
        accountType: true,
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");
      const values = ctx.req.valid("json");

      if (!id) {
        return ctx.json({ error: "Missing id." }, 400);
      }

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const [data] = await db
        .update(accounts)
        .set(values)
        .where(and(eq(accounts.userId, auth.userId), eq(accounts.id, id)))
        .returning();

      if (!data) {
        return ctx.json({ error: "Not found." }, 404);
      }

      return ctx.json({ data });
    }
  )
  .delete(
    "/:id",
    clerkMiddleware(),
    zValidator(
      "param",
      z.object({
        id: z.string().optional(),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");

      if (!id) {
        return ctx.json({ error: "Missing id." }, 400);
      }

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const [data] = await db
        .delete(accounts)
        .where(and(eq(accounts.userId, auth.userId), eq(accounts.id, id)))
        .returning({
          id: accounts.id,
        });

      if (!data) {
        return ctx.json({ error: "Not found." }, 404);
      }

      return ctx.json({ data });
    }
  );

export default app;