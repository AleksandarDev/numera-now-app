import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { endOfDay, parse, subDays } from "date-fns";
import { aliasedTable, and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { UTCDate } from "@date-fns/utc";

import { db } from "@/db/drizzle";
import {
  accounts,
  categories,
  insertTransactionSchema,
  transactions,
} from "@/db/schema";

const app = new Hono()
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        accountId: z.string().optional(),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { from, to, accountId } = ctx.req.valid("query");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      const startDate = from
        ? parse(from, "yyyy-MM-dd", new UTCDate())
        : subDays(new UTCDate(), 30);
      const endDate = to
        ? endOfDay(parse(to, "yyyy-MM-dd", new UTCDate()))
        : new UTCDate();

      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const data = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          category: categories.name,
          categoryId: transactions.categoryId,
          payee: transactions.payee,
          amount: transactions.amount,
          notes: transactions.notes,
          account: accounts.name,
          accountCode: accounts.code,
          accountId: transactions.accountId,
          creditAccount: creditAccounts.name,
          creditAccountCode: creditAccounts.code,
          creditAccountId: transactions.creditAccountId,
          debitAccount: debitAccounts.name,
          debitAccountCode: debitAccounts.code,
          debitAccountId: transactions.debitAccountId,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
        .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            accountId
              ? or(
                eq(transactions.accountId, accountId),
                eq(transactions.creditAccountId, accountId),
                eq(transactions.debitAccountId, accountId))
              : undefined,
            or(
              eq(accounts.userId, auth.userId),
              eq(creditAccounts.userId, auth.userId),
              eq(debitAccounts.userId, auth.userId)
            ),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        )
        .orderBy(desc(transactions.date));

      return ctx.json({ data });
    }
  )
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

      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const [data] = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          categoryId: transactions.categoryId,
          payee: transactions.payee,
          amount: transactions.amount,
          notes: transactions.notes,
          accountId: transactions.accountId,
          creditAccountId: transactions.creditAccountId,
          debitAccountId: transactions.debitAccountId,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
        .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
        .where(
          and(
            eq(transactions.id, id),
            or(
              eq(accounts.userId, auth.userId),
              eq(creditAccounts.userId, auth.userId),
              eq(debitAccounts.userId, auth.userId)
            ),
          )
        );

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
      insertTransactionSchema.omit({
        id: true,
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      if (values.amount < 0 && !values.accountId) {
        return ctx.json({ error: "When using debit and credit accounts, amount must be positive or zero." }, 400);
      }

      // TODO: Fix users being able to create transactions with other users' accounts
      const [data] = await db
        .insert(transactions)
        .values({
          id: createId(),
          ...values,
        })
        .returning();

      return ctx.json({ data });
    }
  )
  .post(
    "/bulk-create",
    clerkMiddleware(),
    zValidator("json", z.array(insertTransactionSchema.omit({ id: true }))),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      if (values.some((value) => value.amount < 0 && !value.accountId)) {
        return ctx.json({ error: "When using debit and credit accounts, amount must be positive or zero." }, 400);
      }

      // TODO: Fix users being able to create transactions with other users' accounts
      const data = await db
        .insert(transactions)
        .values(
          values.map((value) => ({
            id: createId(),
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

      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const transactionsToDelete = db.$with("transactions_to_delete").as(
        db
          .select({ id: transactions.id })
          .from(transactions)
          .leftJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
          .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
          .where(
            and(
              inArray(transactions.id, values.ids),
              or(
                eq(accounts.userId, auth.userId),
                eq(creditAccounts.userId, auth.userId),
                eq(debitAccounts.userId, auth.userId)
              ),
            )
          )
      );

      const data = await db
        .with(transactionsToDelete)
        .delete(transactions)
        .where(
          inArray(
            transactions.id,
            sql`(select id from ${transactionsToDelete})`
          )
        )
        .returning({
          id: transactions.id,
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
      insertTransactionSchema.omit({
        id: true,
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

      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const transactionsToUpdate = db.$with("transactions_to_update").as(
        db
          .select({ id: transactions.id })
          .from(transactions)
          .leftJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
          .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
          .where(
            and(
              eq(transactions.id, id),
              or(
                eq(accounts.userId, auth.userId),
                eq(creditAccounts.userId, auth.userId),
                eq(debitAccounts.userId, auth.userId)
              ),
            )
          )
      );

      console.log('transactionsToUpdate', transactionsToUpdate.id);

      const [data] = await db
        .with(transactionsToUpdate)
        .update(transactions)
        .set(values)
        .where(
          inArray(
            transactions.id,
            sql`(select id from ${transactionsToUpdate})`
          )
        )
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

      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const transactionsToDelete = db.$with("transactions_to_delete").as(
        db
          .select({ id: transactions.id })
          .from(transactions)
          .leftJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
          .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
          .where(
            and(
              eq(transactions.id, id),
              or(
                eq(accounts.userId, auth.userId),
                eq(creditAccounts.userId, auth.userId),
                eq(debitAccounts.userId, auth.userId)
              ),
            )
          )
      );

      const [data] = await db
        .with(transactionsToDelete)
        .delete(transactions)
        .where(
          inArray(
            transactions.id,
            sql`(select id from ${transactionsToDelete})`
          )
        )
        .returning({
          id: transactions.id,
        });

      if (!data) {
        return ctx.json({ error: "Not found." }, 404);
      }

      return ctx.json({ data });
    }
  );

export default app;