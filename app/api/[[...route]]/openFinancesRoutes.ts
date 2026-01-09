import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import { openFinancesSettings } from '@/db/schema';

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
                dateFrom: z.string().nullable().optional(),
                dateTo: z.string().nullable().optional(),
                allowEmbedding: z.boolean().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Parse dates if provided
            const parsedValues = {
                ...values,
                dateFrom: values.dateFrom ? new Date(values.dateFrom) : null,
                dateTo: values.dateTo ? new Date(values.dateTo) : null,
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
        let exposedMetrics: Record<string, unknown> = {};
        try {
            exposedMetrics = JSON.parse(settings.exposedMetrics);
        } catch (error) {
            console.error('Error parsing exposed metrics:', error);
        }

        // Return only the publicly configured data
        return ctx.json({
            data: {
                pageTitle: settings.pageTitle,
                pageDescription: settings.pageDescription,
                metrics: exposedMetrics,
                dateFrom: settings.dateFrom,
                dateTo: settings.dateTo,
                allowEmbedding: settings.allowEmbedding,
            },
        });
    });

export default app;
