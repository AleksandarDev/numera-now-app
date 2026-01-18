import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { aliasedTable, and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import { accounts, openFinancesSettings, transactions } from '@/db/schema';
import { convertAmountFromMiliunits, formatCurrency } from '@/lib/utils';

const app = new Hono()
    // Get open finances settings
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [data] = await db
            .select()
            .from(openFinancesSettings)
            .where(eq(openFinancesSettings.userId, auth.userId));

        return ctx.json({ data: data ?? null });
    })
    // Update open finances settings
    .patch(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                isEnabled: z.boolean().optional(),
                exposedMetrics: z.string().optional(),
                pageTitle: z.string().nullable().optional(),
                pageDescription: z.string().nullable().optional(),
                allowEmbedding: z.boolean().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Update values with timestamp
            const parsedValues = {
                ...values,
                updatedAt: new Date(),
            };

            // Try to update first
            const [data] = await db
                .update(openFinancesSettings)
                .set(parsedValues)
                .where(eq(openFinancesSettings.userId, auth.userId))
                .returning();

            // If no rows were updated, insert a new record
            if (!data) {
                const [newData] = await db
                    .insert(openFinancesSettings)
                    .values({
                        userId: auth.userId,
                        ...parsedValues,
                    })
                    .returning();
                return ctx.json({ data: newData });
            }

            return ctx.json({ data });
        },
    )
    // Public endpoint - Get public financial data (no authentication required)
    .get('/public/:userId', async (ctx) => {
        const userId = ctx.req.param('userId');

        if (!userId) {
            return ctx.json({ error: 'User ID is required.' }, 400);
        }

        // Get the user's open finances settings
        const [settings] = await db
            .select()
            .from(openFinancesSettings)
            .where(
                and(
                    eq(openFinancesSettings.userId, userId),
                    eq(openFinancesSettings.isEnabled, true),
                ),
            );

        if (!settings) {
            return ctx.json(
                { error: 'Open finances not enabled for this user.' },
                404,
            );
        }

        // Parse exposed metrics
        let exposedMetrics: Record<
            string,
            { enabled: boolean; label: string }
        > = {};
        try {
            exposedMetrics = JSON.parse(settings.exposedMetrics);
        } catch (error) {
            console.error(
                'Error parsing exposed metrics for user',
                userId,
                ':',
                error,
            );
        }

        // Calculate real financial data from transactions
        const creditAccounts = aliasedTable(accounts, 'creditAccounts');
        const debitAccounts = aliasedTable(accounts, 'debitAccounts');

        // Get financial summary for the user
        const [financialData] = await db
            .select({
                revenue: sql`
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
                            -- Debits to income accounts (returns) count as negative
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
                            THEN ${transactions.amount}
                            -- Debits to expense accounts
                            WHEN ${debitAccounts.accountClass} = 'expense'
                            THEN ${transactions.amount}
                            -- Credits to expense accounts (returns) count as negative
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
                    or(
                        eq(accounts.userId, userId),
                        eq(creditAccounts.userId, userId),
                        eq(debitAccounts.userId, userId),
                    ),
                    or(
                        isNull(transactions.splitType),
                        eq(transactions.splitType, 'child'),
                    ),
                    ne(transactions.status, 'draft'), // Exclude draft transactions
                ),
            );

        // Calculate profit (revenue - expenses)
        // Convert from milliunits to units
        const revenue = convertAmountFromMiliunits(financialData?.revenue || 0);
        const expenses = Math.abs(
            convertAmountFromMiliunits(financialData?.expenses || 0),
        ); // Make expenses positive for display
        const profit = revenue - expenses;

        // Calculate balance (sum of all asset accounts minus liabilities)
        const balanceDataResult = await db
            .select({
                balance: sql`
                    SUM(
                        CASE 
                            WHEN ${accounts.accountClass} = 'asset' 
                            THEN ${accounts.openingBalance}
                            WHEN ${accounts.accountClass} = 'liability' 
                            THEN -${accounts.openingBalance}
                            ELSE 0 
                        END
                    )
                `.mapWith(Number),
                transactionBalance: sql`
                    SUM(
                        CASE 
                            -- For asset accounts: credits decrease, debits increase
                            WHEN ${creditAccounts.accountClass} = 'asset'
                            THEN -${transactions.amount}
                            WHEN ${debitAccounts.accountClass} = 'asset'
                            THEN ${transactions.amount}
                            -- For liability accounts: credits increase, debits decrease
                            WHEN ${creditAccounts.accountClass} = 'liability'
                            THEN ${transactions.amount}
                            WHEN ${debitAccounts.accountClass} = 'liability'
                            THEN -${transactions.amount}
                            ELSE 0 
                        END
                    )
                `.mapWith(Number),
            })
            .from(accounts)
            .leftJoin(
                transactions,
                and(
                    or(
                        eq(transactions.creditAccountId, accounts.id),
                        eq(transactions.debitAccountId, accounts.id),
                    ),
                    or(
                        isNull(transactions.splitType),
                        eq(transactions.splitType, 'child'),
                    ),
                    ne(transactions.status, 'draft'),
                ),
            )
            .leftJoin(
                creditAccounts,
                eq(transactions.creditAccountId, creditAccounts.id),
            )
            .leftJoin(
                debitAccounts,
                eq(transactions.debitAccountId, debitAccounts.id),
            )
            .where(eq(accounts.userId, userId));

        const balanceData = balanceDataResult[0] as
            | { balance: number; transactionBalance: number }
            | undefined;
        // Convert from milliunits to units
        const balance = convertAmountFromMiliunits(
            (balanceData?.balance || 0) +
                (balanceData?.transactionBalance || 0),
        );

        // Build the metrics object with calculated values
        const metricsWithValues: Record<
            string,
            { enabled: boolean; label: string; value: string }
        > = {};

        const calculatedValues: Record<string, number> = {
            revenue,
            expenses,
            profit,
            balance,
        };

        // Add calculated values to enabled metrics
        for (const [key, config] of Object.entries(exposedMetrics)) {
            if (config.enabled && calculatedValues[key] !== undefined) {
                metricsWithValues[key] = {
                    enabled: true,
                    label: config.label,
                    value: formatCurrency(calculatedValues[key]),
                };
            }
        }

        // Return only the publicly configured data
        return ctx.json({
            data: {
                pageTitle: settings.pageTitle,
                pageDescription: settings.pageDescription,
                metrics: metricsWithValues,
                allowEmbedding: settings.allowEmbedding,
            },
        });
    });

export default app;
