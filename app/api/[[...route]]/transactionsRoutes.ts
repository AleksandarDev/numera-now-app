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
  createTransactionSchema,
  customers,
  insertTransactionSchema,
  transactions,
  settings,
} from "@/db/schema";

// Helper function to open an account and all its parent accounts
const openAccountAndParents = async (accountId: string, userId: string) => {
  if (!accountId) return;

  // Get the account to check its code and current status
  const [account] = await db
    .select({ code: accounts.code, isOpen: accounts.isOpen })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (!account) return;

  // Get all accounts that need to be opened (this account and its parents)
  const accountsToOpen: string[] = [];

  if (account.code) {
    // Find all parent accounts by code prefix
    for (let i = 1; i <= account.code.length; i++) {
      const codePrefix = account.code.substring(0, i);
      const parentAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(
          eq(accounts.code, codePrefix),
          eq(accounts.userId, userId),
          eq(accounts.isOpen, false) // Only get closed accounts
        ));

      accountsToOpen.push(...parentAccounts.map(acc => acc.id));
    }
  } else if (!account.isOpen) {
    // If account has no code but is closed, open it
    accountsToOpen.push(accountId);
  }

  // Open all the accounts that need to be opened
  if (accountsToOpen.length > 0) {
    await db
      .update(accounts)
      .set({ isOpen: true })
      .where(and(
        inArray(accounts.id, accountsToOpen),
        eq(accounts.userId, userId)
      ));
  }
};

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
          payeeCustomerId: transactions.payeeCustomerId,
          payeeCustomerName: customers.name,
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
        .leftJoin(customers, eq(transactions.payeeCustomerId, customers.id))
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
          payeeCustomerId: transactions.payeeCustomerId,
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
      createTransactionSchema
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const values = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Check if double-entry mode is enabled
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      const doubleEntryMode = userSettings?.doubleEntryMode ?? false;

      // Validate double-entry mode requirements
      if (doubleEntryMode) {
        if (!values.creditAccountId || !values.debitAccountId) {
          return ctx.json({ 
            error: "Double-entry mode is enabled. Both credit and debit accounts are required." 
          }, 400);
        }
        if (values.accountId) {
          return ctx.json({ 
            error: "Double-entry mode is enabled. Use creditAccountId and debitAccountId instead of accountId." 
          }, 400);
        }
      }

      if (values.amount < 0 && !values.accountId) {
        return ctx.json({ error: "When using debit and credit accounts, amount must be positive or zero." }, 400);
      }

      // TODO: Fix users being able to create transactions with other users' accounts

      // Open accounts and their parents if they are closed
      if (values.accountId) {
        await openAccountAndParents(values.accountId, auth.userId);
      }
      if (values.creditAccountId) {
        await openAccountAndParents(values.creditAccountId, auth.userId);
      }
      if (values.debitAccountId) {
        await openAccountAndParents(values.debitAccountId, auth.userId);
      }

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
    zValidator("json", z.array(createTransactionSchema)),
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

      // Open accounts and their parents for all transactions
      for (const value of values) {
        if (value.accountId) {
          await openAccountAndParents(value.accountId, auth.userId);
        }
        if (value.creditAccountId) {
          await openAccountAndParents(value.creditAccountId, auth.userId);
        }
        if (value.debitAccountId) {
          await openAccountAndParents(value.debitAccountId, auth.userId);
        }
      }

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
      createTransactionSchema
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

      // Check if double-entry mode is enabled
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      const doubleEntryMode = userSettings?.doubleEntryMode ?? false;

      // Validate double-entry mode requirements
      if (doubleEntryMode) {
        if (!values.creditAccountId || !values.debitAccountId) {
          return ctx.json({ 
            error: "Double-entry mode is enabled. Both credit and debit accounts are required." 
          }, 400);
        }
        if (values.accountId) {
          return ctx.json({ 
            error: "Double-entry mode is enabled. Use creditAccountId and debitAccountId instead of accountId." 
          }, 400);
        }
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