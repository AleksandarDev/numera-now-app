import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, gte, lte, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import {
    accountingPeriods,
    accounts,
    insertAccountingPeriodSchema,
    transactions,
} from '@/db/schema';

const app = new Hono()
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const data = await db
            .select()
            .from(accountingPeriods)
            .where(eq(accountingPeriods.userId, auth.userId))
            .orderBy(desc(accountingPeriods.startDate));

        return ctx.json({ data });
    })
    .get(
        '/:id',
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

            const [data] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!data) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            insertAccountingPeriodSchema.omit({ id: true, userId: true }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Check for overlapping periods
            const overlappingPeriods = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.userId, auth.userId),
                        or(
                            // New period starts during an existing period
                            and(
                                lte(
                                    accountingPeriods.startDate,
                                    values.startDate,
                                ),
                                gte(
                                    accountingPeriods.endDate,
                                    values.startDate,
                                ),
                            ),
                            // New period ends during an existing period
                            and(
                                lte(
                                    accountingPeriods.startDate,
                                    values.endDate,
                                ),
                                gte(accountingPeriods.endDate, values.endDate),
                            ),
                            // New period completely encompasses an existing period
                            and(
                                gte(
                                    accountingPeriods.startDate,
                                    values.startDate,
                                ),
                                lte(accountingPeriods.endDate, values.endDate),
                            ),
                        ),
                    ),
                );

            if (overlappingPeriods.length > 0) {
                return ctx.json(
                    {
                        error: 'This period overlaps with an existing accounting period.',
                        overlappingPeriods,
                    },
                    400,
                );
            }

            const [data] = await db
                .insert(accountingPeriods)
                .values({
                    id: createId(),
                    ...values,
                    userId: auth.userId,
                })
                .returning();

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id/close',
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
                notes: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const { notes } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get the period
            const [period] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!period) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            if (period.status === 'closed') {
                return ctx.json({ error: 'Period is already closed.' }, 400);
            }

            // Close the period
            const [data] = await db
                .update(accountingPeriods)
                .set({
                    status: 'closed',
                    closedAt: new Date(),
                    closedBy: auth.userId,
                    notes: notes || period.notes,
                })
                .where(eq(accountingPeriods.id, id))
                .returning();

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id/reopen',
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

            // Get the period
            const [period] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!period) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            if (period.status === 'open') {
                return ctx.json({ error: 'Period is already open.' }, 400);
            }

            // Reopen the period
            const [data] = await db
                .update(accountingPeriods)
                .set({
                    status: 'open',
                    closedAt: null,
                    closedBy: null,
                })
                .where(eq(accountingPeriods.id, id))
                .returning();

            return ctx.json({ data });
        },
    )
    .delete(
        '/:id',
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

            const [data] = await db
                .delete(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, id),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/preview-closing',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                startDate: z.coerce.date(),
                endDate: z.coerce.date(),
                profitAndLossAccountId: z.string(),
                retainedEarningsAccountId: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const {
                startDate,
                endDate,
                profitAndLossAccountId,
                retainedEarningsAccountId,
            } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get all income and expense accounts with their balances for the period
            const accountBalances = await db
                .select({
                    accountId: accounts.id,
                    accountName: accounts.name,
                    accountCode: accounts.code,
                    accountClass: accounts.accountClass,
                    accountType: accounts.accountType,
                    balance: transactions.amount,
                })
                .from(transactions)
                .innerJoin(
                    accounts,
                    or(
                        eq(transactions.accountId, accounts.id),
                        eq(transactions.creditAccountId, accounts.id),
                        eq(transactions.debitAccountId, accounts.id),
                    ),
                )
                .where(
                    and(
                        eq(accounts.userId, auth.userId),
                        or(
                            eq(accounts.accountClass, 'income'),
                            eq(accounts.accountClass, 'expense'),
                        ),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                    ),
                );

            // Aggregate balances by account
            const balanceMap = new Map<
                string,
                {
                    accountId: string;
                    accountName: string;
                    accountCode: string | null;
                    accountClass: string | null;
                    accountType: string;
                    balance: number;
                }
            >();

            for (const row of accountBalances) {
                const key = row.accountId;
                const existing = balanceMap.get(key);
                const amount = row.balance || 0;

                if (existing) {
                    existing.balance += amount;
                } else {
                    balanceMap.set(key, {
                        accountId: row.accountId,
                        accountName: row.accountName,
                        accountCode: row.accountCode,
                        accountClass: row.accountClass,
                        accountType: row.accountType,
                        balance: amount,
                    });
                }
            }

            const balances = Array.from(balanceMap.values());
            const incomeAccounts = balances.filter(
                (b) => b.accountClass === 'income',
            );
            const expenseAccounts = balances.filter(
                (b) => b.accountClass === 'expense',
            );

            const totalIncome = incomeAccounts.reduce(
                (sum, acc) => sum + acc.balance,
                0,
            );
            const totalExpenses = expenseAccounts.reduce(
                (sum, acc) => sum + acc.balance,
                0,
            );
            const netResult = totalIncome + totalExpenses; // Expenses are typically negative

            // Validate accounts exist
            const [profitAndLossAccount] = await db
                .select()
                .from(accounts)
                .where(
                    and(
                        eq(accounts.id, profitAndLossAccountId),
                        eq(accounts.userId, auth.userId),
                    ),
                );

            if (!profitAndLossAccount) {
                return ctx.json(
                    { error: 'Profit and loss account not found.' },
                    404,
                );
            }

            let retainedEarningsAccount = null;
            if (retainedEarningsAccountId) {
                [retainedEarningsAccount] = await db
                    .select()
                    .from(accounts)
                    .where(
                        and(
                            eq(accounts.id, retainedEarningsAccountId),
                            eq(accounts.userId, auth.userId),
                        ),
                    );

                if (!retainedEarningsAccount) {
                    return ctx.json(
                        { error: 'Retained earnings account not found.' },
                        404,
                    );
                }
            }

            return ctx.json({
                data: {
                    incomeAccounts,
                    expenseAccounts,
                    totalIncome,
                    totalExpenses,
                    netResult,
                    profitAndLossAccount: {
                        id: profitAndLossAccount.id,
                        name: profitAndLossAccount.name,
                        code: profitAndLossAccount.code,
                    },
                    retainedEarningsAccount: retainedEarningsAccount
                        ? {
                              id: retainedEarningsAccount.id,
                              name: retainedEarningsAccount.name,
                              code: retainedEarningsAccount.code,
                          }
                        : null,
                },
            });
        },
    )
    .post(
        '/create-closing-entries',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                periodId: z.string(),
                profitAndLossAccountId: z.string(),
                retainedEarningsAccountId: z.string().optional(),
                closingDate: z.coerce.date(),
                transactionStatus: z
                    .enum(['draft', 'pending', 'completed', 'reconciled'])
                    .default('completed'),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const {
                periodId,
                profitAndLossAccountId,
                retainedEarningsAccountId,
                closingDate,
                transactionStatus,
            } = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Get the period
            const [period] = await db
                .select()
                .from(accountingPeriods)
                .where(
                    and(
                        eq(accountingPeriods.id, periodId),
                        eq(accountingPeriods.userId, auth.userId),
                    ),
                );

            if (!period) {
                return ctx.json({ error: 'Period not found.' }, 404);
            }

            // Get all income and expense accounts with their balances for the period
            const accountBalances = await db
                .select({
                    accountId: accounts.id,
                    accountName: accounts.name,
                    accountCode: accounts.code,
                    accountClass: accounts.accountClass,
                    accountType: accounts.accountType,
                    balance: transactions.amount,
                })
                .from(transactions)
                .innerJoin(
                    accounts,
                    or(
                        eq(transactions.accountId, accounts.id),
                        eq(transactions.creditAccountId, accounts.id),
                        eq(transactions.debitAccountId, accounts.id),
                    ),
                )
                .where(
                    and(
                        eq(accounts.userId, auth.userId),
                        or(
                            eq(accounts.accountClass, 'income'),
                            eq(accounts.accountClass, 'expense'),
                        ),
                        gte(transactions.date, period.startDate),
                        lte(transactions.date, period.endDate),
                    ),
                );

            // Aggregate balances by account
            const balanceMap = new Map<string, number>();
            for (const row of accountBalances) {
                const key = row.accountId;
                const existing = balanceMap.get(key) || 0;
                balanceMap.set(key, existing + (row.balance || 0));
            }

            // Get user settings for double-entry mode
            const { settings } = await import('@/db/schema');
            const [userSettings] = await db
                .select()
                .from(settings)
                .where(eq(settings.userId, auth.userId));

            const doubleEntryMode = userSettings?.doubleEntryMode ?? false;

            // Create closing entries
            const createdTransactions = [];
            const splitGroupId = createId();

            // In double-entry mode, create journal entries
            if (doubleEntryMode) {
                // Close income accounts (credit balance) -> debit income, credit P&L
                // Close expense accounts (debit balance) -> debit P&L, credit expense
                for (const [accountId, balance] of balanceMap.entries()) {
                    if (balance === 0) continue;

                    const [account] = await db
                        .select()
                        .from(accounts)
                        .where(eq(accounts.id, accountId));

                    if (!account) continue;

                    const transactionId = createId();
                    let creditAccountId: string;
                    let debitAccountId: string;

                    if (account.accountClass === 'income') {
                        // Close income: debit income account, credit P&L
                        debitAccountId = accountId;
                        creditAccountId = profitAndLossAccountId;
                    } else {
                        // Close expense: debit P&L, credit expense account
                        debitAccountId = profitAndLossAccountId;
                        creditAccountId = accountId;
                    }

                    const [transaction] = await db
                        .insert(transactions)
                        .values({
                            id: transactionId,
                            amount: Math.abs(balance),
                            payee: `Year closing - ${account.name}`,
                            notes: `Closing entry for period ${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]}`,
                            date: closingDate,
                            creditAccountId,
                            debitAccountId,
                            status: transactionStatus,
                            statusChangedAt: new Date(),
                            statusChangedBy: auth.userId,
                            splitGroupId,
                            splitType: 'child',
                            closingPeriodId: periodId,
                        })
                        .returning();

                    createdTransactions.push(transaction);
                }

                // If retained earnings account is specified, transfer P&L to it
                if (retainedEarningsAccountId) {
                    // Calculate net result
                    const netResult = Array.from(balanceMap.values()).reduce(
                        (sum, balance) => sum + balance,
                        0,
                    );

                    if (netResult !== 0) {
                        const transactionId = createId();
                        let creditAccountId: string;
                        let debitAccountId: string;

                        if (netResult > 0) {
                            // Profit: debit P&L, credit Retained Earnings
                            debitAccountId = profitAndLossAccountId;
                            creditAccountId = retainedEarningsAccountId;
                        } else {
                            // Loss: debit Retained Earnings, credit P&L
                            debitAccountId = retainedEarningsAccountId;
                            creditAccountId = profitAndLossAccountId;
                        }

                        const [transaction] = await db
                            .insert(transactions)
                            .values({
                                id: transactionId,
                                amount: Math.abs(netResult),
                                payee: 'Year closing - Transfer to Retained Earnings',
                                notes: `Transfer net result to retained earnings for period ${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]}`,
                                date: closingDate,
                                creditAccountId,
                                debitAccountId,
                                status: transactionStatus,
                                statusChangedAt: new Date(),
                                statusChangedBy: auth.userId,
                                splitGroupId,
                                splitType: 'child',
                                closingPeriodId: periodId,
                            })
                            .returning();

                        createdTransactions.push(transaction);
                    }
                }
            } else {
                // Single-entry mode: create simple transactions
                for (const [accountId, balance] of balanceMap.entries()) {
                    if (balance === 0) continue;

                    const [account] = await db
                        .select()
                        .from(accounts)
                        .where(eq(accounts.id, accountId));

                    if (!account) continue;

                    const transactionId = createId();

                    // Close the account by reversing its balance
                    const [transaction] = await db
                        .insert(transactions)
                        .values({
                            id: transactionId,
                            amount: -balance, // Reverse the balance
                            payee: `Year closing - ${account.name}`,
                            notes: `Closing entry for period ${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]}`,
                            date: closingDate,
                            accountId,
                            status: transactionStatus,
                            statusChangedAt: new Date(),
                            statusChangedBy: auth.userId,
                            splitGroupId,
                            splitType: 'child',
                            closingPeriodId: periodId,
                        })
                        .returning();

                    createdTransactions.push(transaction);
                }

                // Transfer net result to P&L account
                const netResult = Array.from(balanceMap.values()).reduce(
                    (sum, balance) => sum + balance,
                    0,
                );

                if (netResult !== 0) {
                    const transactionId = createId();
                    const [transaction] = await db
                        .insert(transactions)
                        .values({
                            id: transactionId,
                            amount: netResult,
                            payee: 'Year closing - Net Result',
                            notes: `Net result for period ${period.startDate.toISOString().split('T')[0]} to ${period.endDate.toISOString().split('T')[0]}`,
                            date: closingDate,
                            accountId: profitAndLossAccountId,
                            status: transactionStatus,
                            statusChangedAt: new Date(),
                            statusChangedBy: auth.userId,
                            splitGroupId,
                            splitType: 'child',
                            closingPeriodId: periodId,
                        })
                        .returning();

                    createdTransactions.push(transaction);
                }
            }

            return ctx.json({ data: createdTransactions });
        },
    );

export default app;
