import { UTCDate } from '@date-fns/utc';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { endOfDay, parse, subDays } from 'date-fns';
import { and, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { accounts, transactions } from '@/db/schema';
import { calculateAccountBalance } from '@/lib/accounting';

const app = new Hono().get(
    '/income-statement',
    clerkMiddleware(),
    zValidator(
        'query',
        z.object({
            from: z.string().optional(),
            to: z.string().optional(),
        }),
    ),
    async (ctx) => {
        const auth = getAuth(ctx);
        const { from, to } = ctx.req.valid('query');

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const startDate = from
            ? parse(from, 'yyyy-MM-dd', new UTCDate())
            : subDays(new UTCDate(), 30);
        const endDate = to
            ? endOfDay(parse(to, 'yyyy-MM-dd', new UTCDate()))
            : new UTCDate();

        // Get all income and expense accounts for the user
        const allAccounts = await db
            .select({
                id: accounts.id,
                name: accounts.name,
                code: accounts.code,
                accountClass: accounts.accountClass,
                openingBalance: accounts.openingBalance,
                isOpen: accounts.isOpen,
                isReadOnly: accounts.isReadOnly,
            })
            .from(accounts)
            .where(
                and(
                    eq(accounts.userId, auth.userId),
                    or(
                        eq(accounts.accountClass, 'income'),
                        eq(accounts.accountClass, 'expense'),
                    ),
                ),
            );

        // Get account IDs for non-read-only accounts (these have transactions)
        const nonReadOnlyAccountIds = allAccounts
            .filter((a) => !a.isReadOnly)
            .map((a) => a.id);

        // Get transaction totals for the period
        const transactionTotals: Record<
            string,
            { debitTotal: number; creditTotal: number }
        > = {};

        if (nonReadOnlyAccountIds.length > 0) {
            // Get debit totals for the period
            const debitTotals = await db
                .select({
                    accountId: transactions.debitAccountId,
                    total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`.as(
                        'total',
                    ),
                })
                .from(transactions)
                .where(
                    and(
                        inArray(
                            transactions.debitAccountId,
                            nonReadOnlyAccountIds,
                        ),
                        ne(transactions.status, 'draft'),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                    ),
                )
                .groupBy(transactions.debitAccountId);

            // Get credit totals for the period
            const creditTotals = await db
                .select({
                    accountId: transactions.creditAccountId,
                    total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`.as(
                        'total',
                    ),
                })
                .from(transactions)
                .where(
                    and(
                        inArray(
                            transactions.creditAccountId,
                            nonReadOnlyAccountIds,
                        ),
                        ne(transactions.status, 'draft'),
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                    ),
                )
                .groupBy(transactions.creditAccountId);

            // Build transaction totals map
            for (const row of debitTotals) {
                if (row.accountId) {
                    if (!transactionTotals[row.accountId]) {
                        transactionTotals[row.accountId] = {
                            debitTotal: 0,
                            creditTotal: 0,
                        };
                    }
                    transactionTotals[row.accountId].debitTotal = Number(
                        row.total,
                    );
                }
            }

            for (const row of creditTotals) {
                if (row.accountId) {
                    if (!transactionTotals[row.accountId]) {
                        transactionTotals[row.accountId] = {
                            debitTotal: 0,
                            creditTotal: 0,
                        };
                    }
                    transactionTotals[row.accountId].creditTotal = Number(
                        row.total,
                    );
                }
            }
        }

        // Calculate balances for each account
        const accountBalances: Record<string, number> = {};

        for (const account of allAccounts) {
            if (account.isReadOnly || !account.accountClass) continue;

            const totals = transactionTotals[account.id] || {
                debitTotal: 0,
                creditTotal: 0,
            };

            // Calculate balance based on account class
            // Note: For income statement, we're looking at the activity during the period
            // not including opening balance since it's a period report
            accountBalances[account.id] = calculateAccountBalance(
                account.accountClass,
                totals.debitTotal,
                totals.creditTotal,
                0, // Don't include opening balance for period reports
            );
        }

        // Calculate balances for read-only accounts (sum of children)
        const readOnlyAccounts = allAccounts
            .filter((a) => a.isReadOnly && a.code)
            .sort((a, b) => (b.code?.length ?? 0) - (a.code?.length ?? 0));

        for (const account of readOnlyAccounts) {
            const parentCode = account.code;
            if (!parentCode) continue;
            let childrenSum = 0;

            // Find only direct children
            for (const otherAccount of allAccounts) {
                if (
                    otherAccount.code?.startsWith(parentCode) &&
                    otherAccount.code.length === parentCode.length + 1 &&
                    accountBalances[otherAccount.id] !== undefined
                ) {
                    childrenSum += accountBalances[otherAccount.id];
                }
            }

            accountBalances[account.id] = childrenSum;
        }

        // Separate income and expense accounts - only readonly accounts for hierarchy display
        const incomeAccounts = allAccounts
            .filter(
                (a) => a.accountClass === 'income' && a.isOpen && a.isReadOnly,
            )
            .map((a) => ({
                id: a.id,
                name: a.name,
                code: a.code,
                balance: accountBalances[a.id] || 0,
                isReadOnly: a.isReadOnly,
            }))
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        const expenseAccounts = allAccounts
            .filter(
                (a) => a.accountClass === 'expense' && a.isOpen && a.isReadOnly,
            )
            .map((a) => ({
                id: a.id,
                name: a.name,
                code: a.code,
                balance: accountBalances[a.id] || 0,
                isReadOnly: a.isReadOnly,
            }))
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        // Calculate totals - only sum top-level parent accounts (code length 1)
        // to avoid double-counting since readonly accounts contain sums of their children
        // For income accounts (credit normal), positive balance means income
        const totalIncome = incomeAccounts
            .filter((account) => account.code?.length === 1)
            .reduce((sum, account) => sum + account.balance, 0);

        // For expense accounts (debit normal), positive balance means expense
        const totalExpenses = expenseAccounts
            .filter((account) => account.code?.length === 1)
            .reduce((sum, account) => sum + account.balance, 0);

        // Net income = Income - Expenses
        const netIncome = totalIncome - totalExpenses;

        return ctx.json({
            data: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                incomeAccounts,
                expenseAccounts,
                totalIncome,
                totalExpenses,
                netIncome,
            },
        });
    },
);

export default app;
