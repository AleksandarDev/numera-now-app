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
  documents,
  documentTypes,
  transactions,
  settings,
  transactionStatusHistory,
} from "@/db/schema";

// Helper function to record status change
const recordStatusChange = async (
  transactionId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string,
  notes?: string
) => {
  await db.insert(transactionStatusHistory).values({
    id: createId(),
    transactionId,
    fromStatus,
    toStatus,
    changedBy,
    notes,
  });
};

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

      // Get required document types for this user
      const requiredDocTypes = await db
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(and(
          eq(documentTypes.userId, auth.userId),
          eq(documentTypes.isRequired, true)
        ));
      const requiredDocTypeIds = requiredDocTypes.map(dt => dt.id);

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
          accountIsOpen: accounts.isOpen,
          creditAccount: creditAccounts.name,
          creditAccountCode: creditAccounts.code,
          creditAccountId: transactions.creditAccountId,
          creditAccountIsOpen: creditAccounts.isOpen,
          creditAccountType: creditAccounts.accountType,
          debitAccount: debitAccounts.name,
          debitAccountCode: debitAccounts.code,
          debitAccountId: transactions.debitAccountId,
          debitAccountIsOpen: debitAccounts.isOpen,
          debitAccountType: debitAccounts.accountType,
          status: transactions.status,
          statusChangedAt: transactions.statusChangedAt,
          statusChangedBy: transactions.statusChangedBy,
          splitGroupId: transactions.splitGroupId,
          splitType: transactions.splitType,
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

      // Get document counts and required documents status for each transaction
      const transactionIds = data.map(t => t.id);
      let documentCounts: Map<string, { total: number; requiredTypes: string[] }> = new Map();

      if (transactionIds.length > 0) {
        const docsData = await db
          .select({
            transactionId: documents.transactionId,
            documentTypeId: documents.documentTypeId,
          })
          .from(documents)
          .where(and(
            inArray(documents.transactionId, transactionIds),
            eq(documents.isDeleted, false)
          ));

        // Group by transaction and count
        docsData.forEach(doc => {
          const existing = documentCounts.get(doc.transactionId) || { total: 0, requiredTypes: [] };
          existing.total++;
          if (requiredDocTypeIds.includes(doc.documentTypeId)) {
            if (!existing.requiredTypes.includes(doc.documentTypeId)) {
              existing.requiredTypes.push(doc.documentTypeId);
            }
          }
          documentCounts.set(doc.transactionId, existing);
        });
      }

      // Combine data with document info
      const dataWithDocs = data.map(transaction => ({
        ...transaction,
        documentCount: documentCounts.get(transaction.id)?.total ?? 0,
        hasAllRequiredDocuments: requiredDocTypeIds.length === 0 ||
          (documentCounts.get(transaction.id)?.requiredTypes.length ?? 0) >= requiredDocTypeIds.length,
        requiredDocumentTypes: requiredDocTypeIds.length,
        attachedRequiredTypes: documentCounts.get(transaction.id)?.requiredTypes.length ?? 0,
      }));

      return ctx.json({ data: dataWithDocs });
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
          creditAccountType: creditAccounts.accountType,
          debitAccountId: transactions.debitAccountId,
          debitAccountType: debitAccounts.accountType,
          status: transactions.status,
          statusChangedAt: transactions.statusChangedAt,
          statusChangedBy: transactions.statusChangedBy,
          splitGroupId: transactions.splitGroupId,
          splitType: transactions.splitType,
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

      // Validate double-entry mode requirements (skip for draft transactions)
      if (doubleEntryMode && values.status !== "draft") {
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

      // Check if any of the accounts are read-only
      const accountIds = [values.accountId, values.creditAccountId, values.debitAccountId].filter(Boolean) as string[];
      const accountMap = new Map<string, { id: string; name: string; isReadOnly: boolean; accountType: string }>();
      if (accountIds.length > 0) {
        const accountsToCheck = await db
          .select({ id: accounts.id, name: accounts.name, isReadOnly: accounts.isReadOnly, accountType: accounts.accountType })
          .from(accounts)
          .where(and(
            inArray(accounts.id, accountIds),
            eq(accounts.userId, auth.userId)
          ));

        accountsToCheck.forEach((acc) => accountMap.set(acc.id, acc));

        const readOnlyAccounts = accountsToCheck.filter(acc => acc.isReadOnly);
        if (readOnlyAccounts.length > 0) {
          return ctx.json({
            error: `Cannot use read-only account(s) in transactions: ${readOnlyAccounts.map(a => a.name).join(', ')}`
          }, 400);
        }
      }

      if (doubleEntryMode) {
        if (values.creditAccountId) {
          const creditAccount = accountMap.get(values.creditAccountId);
          if (!creditAccount) {
            return ctx.json({ error: "Credit account not found for this user." }, 400);
          }
          if (creditAccount.accountType === "debit") {
            return ctx.json({ error: `Account ${creditAccount.name} is debit-only and cannot be used as a credit account.` }, 400);
          }
        }

        if (values.debitAccountId) {
          const debitAccount = accountMap.get(values.debitAccountId);
          if (!debitAccount) {
            return ctx.json({ error: "Debit account not found for this user." }, 400);
          }
          if (debitAccount.accountType === "credit") {
            return ctx.json({ error: `Account ${debitAccount.name} is credit-only and cannot be used as a debit account.` }, 400);
          }
        }
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

      const transactionId = createId();
      const status = values.status || "draft";

      const [data] = await db
        .insert(transactions)
        .values({
          id: transactionId,
          ...values,
          status,
          statusChangedAt: new UTCDate(),
          statusChangedBy: auth.userId,
        })
        .returning();

      // Record initial status in history
      await recordStatusChange(transactionId, null, status, auth.userId, "Transaction created");

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

      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      const doubleEntryMode = userSettings?.doubleEntryMode ?? false;

      if (values.some((value) => value.amount < 0 && !value.accountId)) {
        return ctx.json({ error: "When using debit and credit accounts, amount must be positive or zero." }, 400);
      }

      if (doubleEntryMode) {
        for (const value of values) {
          if (value.status !== "draft") {
            if (!value.creditAccountId || !value.debitAccountId) {
              return ctx.json({
                error: "Double-entry mode is enabled. Both credit and debit accounts are required for each transaction."
              }, 400);
            }
            if (value.accountId) {
              return ctx.json({
                error: "Double-entry mode is enabled. Use creditAccountId and debitAccountId instead of accountId."
              }, 400);
            }
          }
        }
      }

      // Check if any of the accounts are read-only
      const allAccountIds = values.flatMap(v => [v.accountId, v.creditAccountId, v.debitAccountId]).filter(Boolean) as string[];
      const accountMap = new Map<string, { id: string; name: string; isReadOnly: boolean; accountType: string }>();
      if (allAccountIds.length > 0) {
        const accountsToCheck = await db
          .select({ id: accounts.id, name: accounts.name, isReadOnly: accounts.isReadOnly, accountType: accounts.accountType })
          .from(accounts)
          .where(and(
            inArray(accounts.id, allAccountIds),
            eq(accounts.userId, auth.userId)
          ));

        accountsToCheck.forEach((acc) => accountMap.set(acc.id, acc));

        const readOnlyAccounts = accountsToCheck.filter(acc => acc.isReadOnly);
        if (readOnlyAccounts.length > 0) {
          return ctx.json({
            error: `Cannot use read-only account(s) in transactions: ${readOnlyAccounts.map(a => a.name).join(', ')}`
          }, 400);
        }
      }

      if (doubleEntryMode) {
        for (const value of values) {
          if (value.creditAccountId) {
            const creditAccount = accountMap.get(value.creditAccountId);
            if (!creditAccount) {
              return ctx.json({ error: "Credit account not found for this user." }, 400);
            }
            if (creditAccount.accountType === "debit") {
              return ctx.json({ error: `Account ${creditAccount.name} is debit-only and cannot be used as a credit account.` }, 400);
            }
          }

          if (value.debitAccountId) {
            const debitAccount = accountMap.get(value.debitAccountId);
            if (!debitAccount) {
              return ctx.json({ error: "Debit account not found for this user." }, 400);
            }
            if (debitAccount.accountType === "credit") {
              return ctx.json({ error: `Account ${debitAccount.name} is credit-only and cannot be used as a debit account.` }, 400);
            }
          }
        }
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
      createTransactionSchema,
      (result, ctx) => {
        if (!result.success) {
          const errors = result.error.issues.map(issue => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          });
          console.error('[PATCH /transactions/:id] Validation failed:', JSON.stringify(result.error.issues, null, 2));
          return ctx.json({
            error: errors.join('; '),
            validationErrors: result.error.issues
          }, 400);
        }
      }
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");
      const values = ctx.req.valid("json");

      console.log('[PATCH /transactions/:id] Request:', { id, values });

      if (!id) {
        console.error('[PATCH /transactions/:id] Missing id');
        return ctx.json({ error: "Missing id." }, 400);
      }

      if (!auth?.userId) {
        console.error('[PATCH /transactions/:id] Unauthorized - no userId');
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Check if double-entry mode is enabled
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      const doubleEntryMode = userSettings?.doubleEntryMode ?? false;
      console.log('[PATCH /transactions/:id] Double-entry mode:', doubleEntryMode);

      // Validate double-entry mode requirements (skip for draft transactions)
      if (doubleEntryMode && values.status !== "draft") {
        if (!values.creditAccountId || !values.debitAccountId) {
          const error = "Double-entry mode is enabled. Both credit and debit accounts are required.";
          console.error('[PATCH /transactions/:id]', error, { creditAccountId: values.creditAccountId, debitAccountId: values.debitAccountId });
          return ctx.json({ error }, 400);
        }
        if (values.accountId) {
          const error = "Double-entry mode is enabled. Use creditAccountId and debitAccountId instead of accountId.";
          console.error('[PATCH /transactions/:id]', error);
          return ctx.json({ error }, 400);
        }
      }

      // Check if any of the accounts are read-only
      const accountIds = [values.accountId, values.creditAccountId, values.debitAccountId].filter(Boolean) as string[];
      const accountMap = new Map<string, { id: string; name: string; isReadOnly: boolean; accountType: string }>();
      if (accountIds.length > 0) {
        const accountsToCheck = await db
          .select({ id: accounts.id, name: accounts.name, isReadOnly: accounts.isReadOnly, accountType: accounts.accountType })
          .from(accounts)
          .where(and(
            inArray(accounts.id, accountIds),
            eq(accounts.userId, auth.userId)
          ));

        accountsToCheck.forEach((acc) => accountMap.set(acc.id, acc));

        const readOnlyAccounts = accountsToCheck.filter(acc => acc.isReadOnly);
        if (readOnlyAccounts.length > 0) {
          const error = `Cannot use read-only account(s) in transactions: ${readOnlyAccounts.map(a => a.name).join(', ')}`;
          console.error('[PATCH /transactions/:id]', error);
          return ctx.json({ error }, 400);
        }
      }

      if (doubleEntryMode) {
        if (values.creditAccountId) {
          const creditAccount = accountMap.get(values.creditAccountId);
          if (!creditAccount) {
            const error = "Credit account not found for this user.";
            console.error('[PATCH /transactions/:id]', error, { creditAccountId: values.creditAccountId });
            return ctx.json({ error }, 400);
          }
          if (creditAccount.accountType === "debit") {
            const error = `Account ${creditAccount.name} is debit-only and cannot be used as a credit account.`;
            console.error('[PATCH /transactions/:id]', error);
            return ctx.json({ error }, 400);
          }
        }

        if (values.debitAccountId) {
          const debitAccount = accountMap.get(values.debitAccountId);
          if (!debitAccount) {
            const error = "Debit account not found for this user.";
            console.error('[PATCH /transactions/:id]', error, { debitAccountId: values.debitAccountId });
            return ctx.json({ error }, 400);
          }
          if (debitAccount.accountType === "credit") {
            const error = `Account ${debitAccount.name} is credit-only and cannot be used as a debit account.`;
            console.error('[PATCH /transactions/:id]', error);
            return ctx.json({ error }, 400);
          }
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

      console.log('[PATCH /transactions/:id] Updating transaction...');

      // Get the old transaction to check for status change
      const [oldTransaction] = await db
        .select({ status: transactions.status })
        .from(transactions)
        .where(eq(transactions.id, id));

      const updateData: any = {
        ...values,
      };

      // Track status changes
      if (values.status && oldTransaction && values.status !== oldTransaction.status) {
        updateData.statusChangedAt = new UTCDate();
        updateData.statusChangedBy = auth.userId;
      }

      const [data] = await db
        .with(transactionsToUpdate)
        .update(transactions)
        .set(updateData)
        .where(
          inArray(
            transactions.id,
            sql`(select id from ${transactionsToUpdate})`
          )
        )
        .returning();

      if (!data) {
        console.error('[PATCH /transactions/:id] Transaction not found or not authorized:', { id });
        return ctx.json({ error: "Transaction not found or you don't have permission to edit it." }, 404);
      }

      // Record status change in history if status changed
      if (values.status && oldTransaction && values.status !== oldTransaction.status) {
        await recordStatusChange(id, oldTransaction.status, values.status, auth.userId);
        console.log('[PATCH /transactions/:id] Status changed:', { id, from: oldTransaction.status, to: values.status });
      }

      console.log('[PATCH /transactions/:id] Success:', { id, status: data.status });
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
  )
  .get(
    "/:id/status-history",
    zValidator(
      "param",
      z.object({
        id: z.string(),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Verify the transaction belongs to the user
      const creditAccounts = aliasedTable(accounts, "creditAccounts");
      const debitAccounts = aliasedTable(accounts, "debitAccounts");
      const [transaction] = await db
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
            )
          )
        );

      if (!transaction) {
        return ctx.json({ error: "Not found." }, 404);
      }

      const history = await db
        .select()
        .from(transactionStatusHistory)
        .where(eq(transactionStatusHistory.transactionId, id))
        .orderBy(desc(transactionStatusHistory.changedAt));

      return ctx.json({ data: history });
    }
  )
  .get(
    "/:id/can-reconcile",
    zValidator(
      "param",
      z.object({
        id: z.string(),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { id } = ctx.req.valid("param");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Import reconciliation check function
      const { getReconciliationStatus } = await import("@/lib/reconciliation");

      try {
        const status = await getReconciliationStatus(id, auth.userId);
        return ctx.json({ data: status });
      } catch (error) {
        return ctx.json({ error: "Failed to check reconciliation status." }, 500);
      }
    }
  )
  .get(
    "/split-group/:splitGroupId",
    zValidator(
      "param",
      z.object({
        splitGroupId: z.string(),
      })
    ),
    clerkMiddleware(),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { splitGroupId } = ctx.req.valid("param");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

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
          accountId: transactions.accountId,
          creditAccount: creditAccounts.name,
          creditAccountId: transactions.creditAccountId,
          debitAccount: debitAccounts.name,
          debitAccountId: transactions.debitAccountId,
          status: transactions.status,
          splitGroupId: transactions.splitGroupId,
          splitType: transactions.splitType,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(creditAccounts, eq(transactions.creditAccountId, creditAccounts.id))
        .leftJoin(debitAccounts, eq(transactions.debitAccountId, debitAccounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(customers, eq(transactions.payeeCustomerId, customers.id))
        .where(
          and(
            eq(transactions.splitGroupId, splitGroupId),
            or(
              eq(accounts.userId, auth.userId),
              eq(creditAccounts.userId, auth.userId),
              eq(debitAccounts.userId, auth.userId)
            )
          )
        )
        .orderBy(
          sql`CASE WHEN ${transactions.splitType} = 'parent' THEN 0 ELSE 1 END`,
          transactions.id
        );

      if (data.length === 0) {
        return ctx.json({ error: "Split group not found." }, 404);
      }

      return ctx.json({ data });
    }
  )
  .post(
    "/create-split",
    clerkMiddleware(),
    zValidator(
      "json",
      z.object({
        parentTransaction: createTransactionSchema,
        splits: z.array(
          z.object({
            amount: z.number(),
            accountId: z.string().optional(),
            creditAccountId: z.string().optional(),
            debitAccountId: z.string().optional(),
            categoryId: z.string().optional(),
            notes: z.string().optional(),
          })
        ).min(2, "At least 2 splits are required"),
      })
    ),
    async (ctx) => {
      const auth = getAuth(ctx);
      const { parentTransaction, splits } = ctx.req.valid("json");

      if (!auth?.userId) {
        return ctx.json({ error: "Unauthorized." }, 401);
      }

      // Check if double-entry mode is enabled
      const [userSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, auth.userId));

      const doubleEntryMode = userSettings?.doubleEntryMode ?? false;

      // In double-entry mode, validate that total debits equal total credits
      if (doubleEntryMode) {
        const totalDebits = splits
          .filter(s => s.debitAccountId)
          .reduce((sum, s) => sum + s.amount, 0);
        const totalCredits = splits
          .filter(s => s.creditAccountId)
          .reduce((sum, s) => sum + s.amount, 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          return ctx.json({
            error: "In double-entry mode, total debits must equal total credits in split transactions."
          }, 400);
        }
      }

      const splitAccountIds = splits
        .flatMap((s) => [s.creditAccountId, s.debitAccountId])
        .filter(Boolean) as string[];

      const splitAccountMap = new Map<string, { id: string; name: string; accountType: string }>();

      if (splitAccountIds.length > 0) {
        const accountsToCheck = await db
          .select({ id: accounts.id, name: accounts.name, accountType: accounts.accountType })
          .from(accounts)
          .where(and(
            inArray(accounts.id, splitAccountIds),
            eq(accounts.userId, auth.userId)
          ));

        accountsToCheck.forEach((acc) => splitAccountMap.set(acc.id, acc));
      }

      if (doubleEntryMode) {
        for (const split of splits) {
          if (split.creditAccountId) {
            const creditAccount = splitAccountMap.get(split.creditAccountId);
            if (!creditAccount) {
              return ctx.json({ error: "Credit account not found for this user." }, 400);
            }
            if (creditAccount.accountType === "debit") {
              return ctx.json({ error: `Account ${creditAccount.name} is debit-only and cannot be used as a credit account.` }, 400);
            }
          }

          if (split.debitAccountId) {
            const debitAccount = splitAccountMap.get(split.debitAccountId);
            if (!debitAccount) {
              return ctx.json({ error: "Debit account not found for this user." }, 400);
            }
            if (debitAccount.accountType === "credit") {
              return ctx.json({ error: `Account ${debitAccount.name} is credit-only and cannot be used as a debit account.` }, 400);
            }
          }
        }
      }

      // Validate that all splits have either accountId or both creditAccountId and debitAccountId
      for (const split of splits) {
        if (!split.accountId && (!split.creditAccountId || !split.debitAccountId)) {
          return ctx.json({
            error: "Each split must have either accountId or both creditAccountId and debitAccountId."
          }, 400);
        }
      }

      const splitGroupId = createId();
      const status = parentTransaction.status || "pending";

      // Create parent transaction
      const parentId = createId();
      const [parent] = await db
        .insert(transactions)
        .values({
          id: parentId,
          ...parentTransaction,
          splitGroupId,
          splitType: "parent",
          status,
          statusChangedAt: new UTCDate(),
          statusChangedBy: auth.userId,
        })
        .returning();

      // Record initial status in history
      await recordStatusChange(parentId, null, status, auth.userId, "Split transaction created");

      // Create child transactions
      const childTransactions = await db
        .insert(transactions)
        .values(
          splits.map((split) => ({
            id: createId(),
            date: parentTransaction.date,
            payee: parentTransaction.payee,
            payeeCustomerId: parentTransaction.payeeCustomerId,
            amount: split.amount,
            accountId: split.accountId,
            creditAccountId: split.creditAccountId,
            debitAccountId: split.debitAccountId,
            categoryId: split.categoryId,
            notes: split.notes,
            splitGroupId,
            splitType: "child" as const,
            status,
            statusChangedAt: new UTCDate(),
            statusChangedBy: auth.userId,
          }))
        )
        .returning();

      // Record initial status for all child transactions
      for (const child of childTransactions) {
        await recordStatusChange(child.id, null, status, auth.userId, "Split transaction child created");
      }

      return ctx.json({
        data: {
          parent,
          children: childTransactions,
        }
      });
    }
  );

export default app;