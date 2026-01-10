import { UTCDate } from '@date-fns/utc';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { differenceInDays, endOfDay, parse, subDays } from 'date-fns';
import {
    aliasedTable,
    and,
    desc,
    eq,
    gte,
    lte,
    ne,
    or,
    sql,
    sum,
} from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import { accounts, tags, transactions, transactionTags } from '@/db/schema';
import { calculatePercentageChange, fillMissingDays } from '@/lib/utils';

const app = new Hono().get(
    '/',
    clerkMiddleware(),
    zValidator(
        'query',
        z.object({
            from: z.string().optional(),
            to: z.string().optional(),
            accountId: z.string().optional(),
        }),
    ),
    async (ctx) => {
        const auth = getAuth(ctx);
        const { from, to, accountId } = ctx.req.valid('query');

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const startDate = from
            ? parse(from, 'yyyy-MM-dd', new UTCDate())
            : subDays(new UTCDate(), 30);
        const endDate = to
            ? endOfDay(parse(to, 'yyyy-MM-dd', new UTCDate()))
            : new UTCDate();

        const periodLength = differenceInDays(endDate, startDate) + 1;
        const lastPeriodStart = subDays(startDate, periodLength);
        const lastPeriodEnd = subDays(endDate, periodLength);

        async function fetchFinancialData(
            userId: string,
            startDate: Date,
            endDate: Date,
        ) {
            const creditAccounts = aliasedTable(accounts, 'creditAccounts');
            const debitAccounts = aliasedTable(accounts, 'debitAccounts');

            // For double-entry accounting, we need to determine income/expense based on:
            // 1. Account class and normal balance
            // 2. Whether transaction is credit or debit to that account
            //
            // Income accounts (credit normal): Credits increase (income), Debits decrease
            // Expense accounts (debit normal): Debits increase (expense), Credits decrease
            //
            // For filtered account view, we look at the specific account
            // For total view, we aggregate from all income/expense accounts

            return await db
                .select({
                    income: sql`
                        SUM(
                            CASE 
                                -- Legacy transactions with amount >= 0
                                WHEN ${transactions.creditAccountId} IS NULL 
                                    AND ${transactions.debitAccountId} IS NULL 
                                    AND ${transactions.amount} >= 0 
                                THEN ${transactions.amount}
                                -- For filtered account: credits to income accounts or debits to liability/equity
                                WHEN ${accountId ? sql`${transactions.creditAccountId} = ${accountId} AND ${creditAccounts.accountClass} = 'income'` : sql`${creditAccounts.accountClass} = 'income'`}
                                THEN ${transactions.amount}
                                -- For filtered account: debits to income accounts (returns/decreases) count as negative
                                WHEN ${accountId ? sql`${transactions.debitAccountId} = ${accountId} AND ${debitAccounts.accountClass} = 'income'` : sql`false`}
                                THEN -${transactions.amount}
                                ELSE 0 
                            END
                        )
                    `.mapWith(Number),
                    expenses: sql`
                        SUM(
                            CASE 
                                -- Legacy transactions with amount < 0
                                WHEN ${transactions.creditAccountId} IS NULL 
                                    AND ${transactions.debitAccountId} IS NULL 
                                    AND ${transactions.amount} < 0 
                                THEN ${transactions.amount}
                                -- For filtered account: debits to expense accounts
                                WHEN ${accountId ? sql`${transactions.debitAccountId} = ${accountId} AND ${debitAccounts.accountClass} = 'expense'` : sql`${debitAccounts.accountClass} = 'expense'`}
                                THEN ${transactions.amount}
                                -- For filtered account: credits to expense accounts (returns) count as negative
                                WHEN ${accountId ? sql`${transactions.creditAccountId} = ${accountId} AND ${creditAccounts.accountClass} = 'expense'` : sql`false`}
                                THEN -${transactions.amount}
                                ELSE 0 
                            END
                        )
                    `.mapWith(Number),
                    remaining: sum(transactions.amount).mapWith(Number),
                })
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
                        accountId
                            ? or(
                                  eq(transactions.accountId, accountId),
                                  eq(transactions.creditAccountId, accountId),
                                  eq(transactions.debitAccountId, accountId),
                              )
                            : undefined,
                        or(
                            eq(accounts.userId, userId),
                            eq(creditAccounts.userId, userId),
                            eq(debitAccounts.userId, userId),
                        ),
                        ne(transactions.status, 'draft'), // Exclude draft transactions
                        gte(transactions.date, startDate),
                        lte(transactions.date, endDate),
                    ),
                );
        }

        const [currentPeriod] = await fetchFinancialData(
            auth.userId,
            startDate,
            endDate,
        );
        const [lastPeriod] = await fetchFinancialData(
            auth.userId,
            lastPeriodStart,
            lastPeriodEnd,
        );

        const incomeChange = calculatePercentageChange(
            currentPeriod.income,
            lastPeriod.income,
        );

        const expensesChange = calculatePercentageChange(
            currentPeriod.expenses,
            lastPeriod.expenses,
        );

        const remainingChange = calculatePercentageChange(
            currentPeriod.remaining,
            lastPeriod.remaining,
        );

        const creditAccounts = aliasedTable(accounts, 'creditAccounts');
        const debitAccounts = aliasedTable(accounts, 'debitAccounts');

        // Get tag-based spending breakdown
        // A transaction can have multiple tags, so we join through transactionTags
        // Calculate based on account class and transaction direction
        const tagData = await db
            .select({
                name: tags.name,
                value: sql`
                    SUM(
                        CASE 
                            -- Legacy transactions: use absolute value
                            WHEN ${transactions.creditAccountId} IS NULL 
                                AND ${transactions.debitAccountId} IS NULL 
                            THEN ABS(${transactions.amount})
                            -- Double-entry: sum debits to expense accounts (expenses)
                            WHEN ${debitAccounts.accountClass} = 'expense'
                            THEN ${transactions.amount}
                            -- Double-entry: sum credits to income accounts (income)
                            WHEN ${creditAccounts.accountClass} = 'income'
                            THEN ${transactions.amount}
                            ELSE 0
                        END
                    )
                `.mapWith(Number),
            })
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
            .innerJoin(
                transactionTags,
                eq(transactions.id, transactionTags.transactionId),
            )
            .innerJoin(tags, eq(transactionTags.tagId, tags.id))
            .where(
                and(
                    accountId
                        ? or(
                              eq(transactions.accountId, accountId),
                              eq(transactions.creditAccountId, accountId),
                              eq(transactions.debitAccountId, accountId),
                          )
                        : undefined,
                    or(
                        eq(accounts.userId, auth.userId),
                        eq(creditAccounts.userId, auth.userId),
                        eq(debitAccounts.userId, auth.userId),
                    ),
                    ne(transactions.amount, 0),
                    ne(transactions.status, 'draft'), // Exclude draft transactions
                    gte(transactions.date, startDate),
                    lte(transactions.date, endDate),
                ),
            )
            .groupBy(tags.name)
            .orderBy(
                desc(sql`
                SUM(
                    CASE 
                        WHEN ${transactions.creditAccountId} IS NULL 
                            AND ${transactions.debitAccountId} IS NULL 
                        THEN ABS(${transactions.amount})
                        WHEN ${debitAccounts.accountClass} = 'expense'
                        THEN ${transactions.amount}
                        WHEN ${creditAccounts.accountClass} = 'income'
                        THEN ${transactions.amount}
                        ELSE 0
                    END
                )
            `),
            );

        const topTags = tagData.slice(0, 3);
        const otherTags = tagData.slice(3);
        const otherSum = otherTags.reduce(
            (sum, current) => sum + current.value,
            0,
        );

        const finalTags = topTags;

        if (otherTags.length > 0)
            finalTags.push({ name: 'Other', value: otherSum });

        const activeDays = await db
            .select({
                date: transactions.date,
                income: sql`
                    SUM(
                        CASE 
                            -- Legacy transactions with amount >= 0
                            WHEN ${transactions.creditAccountId} IS NULL 
                                AND ${transactions.debitAccountId} IS NULL 
                                AND ${transactions.amount} >= 0 
                            THEN ${transactions.amount}
                            -- Credits to income accounts
                            WHEN ${creditAccounts.accountClass} = 'income'
                            THEN ${transactions.amount}
                            -- Debits to income accounts (returns) - negative income
                            WHEN ${debitAccounts.accountClass} = 'income'
                            THEN -${transactions.amount}
                            ELSE 0 
                        END
                    )
                `.mapWith(Number),
                expenses: sql`
                    SUM(
                        CASE 
                            -- Legacy transactions with amount < 0
                            WHEN ${transactions.creditAccountId} IS NULL 
                                AND ${transactions.debitAccountId} IS NULL 
                                AND ${transactions.amount} < 0 
                            THEN ABS(${transactions.amount})
                            -- Debits to expense accounts
                            WHEN ${debitAccounts.accountClass} = 'expense'
                            THEN ${transactions.amount}
                            -- Credits to expense accounts (returns) - negative expense
                            WHEN ${creditAccounts.accountClass} = 'expense'
                            THEN -${transactions.amount}
                            ELSE 0 
                        END
                    )
                `.mapWith(Number),
            })
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
                    accountId
                        ? or(
                              eq(transactions.accountId, accountId),
                              eq(transactions.creditAccountId, accountId),
                              eq(transactions.debitAccountId, accountId),
                          )
                        : undefined,
                    or(
                        eq(accounts.userId, auth.userId),
                        eq(creditAccounts.userId, auth.userId),
                        eq(debitAccounts.userId, auth.userId),
                    ),
                    ne(transactions.status, 'draft'), // Exclude draft transactions
                    gte(transactions.date, startDate),
                    lte(transactions.date, endDate),
                ),
            )
            .groupBy(transactions.date)
            .orderBy(transactions.date);

        const days = fillMissingDays(activeDays, startDate, endDate);

        return ctx.json({
            data: {
                remainingAmount: currentPeriod.remaining,
                remainingChange,
                incomeAmount: currentPeriod.income,
                incomeChange,
                expensesAmount: currentPeriod.expenses,
                expensesChange,
                tags: finalTags,
                days,
            },
        });
    },
);

export default app;
