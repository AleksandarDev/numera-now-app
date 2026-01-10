import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { dashboardLayouts } from '@/db/schema';

// Widget configuration schemas
const baseWidgetConfigSchema = z.object({
    id: z.string(),
    type: z.enum([
        'data-grid',
        'data-charts',
        'financial-summary',
        'graph',
        'chart',
    ]),
    title: z.string().optional(),
});

const dataGridWidgetConfigSchema = baseWidgetConfigSchema.extend({
    type: z.literal('data-grid'),
    refreshRate: z.number().optional(),
    showBalance: z.boolean().optional(),
    showIncome: z.boolean().optional(),
    showExpenses: z.boolean().optional(),
});

const dataChartsWidgetConfigSchema = baseWidgetConfigSchema.extend({
    type: z.literal('data-charts'),
    refreshRate: z.number().optional(),
    defaultChartType: z.enum(['area', 'bar', 'line']).optional(),
    defaultPieType: z.enum(['pie', 'radar', 'radial']).optional(),
});

const financialSummaryWidgetConfigSchema = baseWidgetConfigSchema.extend({
    type: z.literal('financial-summary'),
    refreshRate: z.number().optional(),
    summaryType: z.enum(['balance', 'income', 'expenses']),
});

const graphWidgetConfigSchema = baseWidgetConfigSchema.extend({
    type: z.literal('graph'),
    refreshRate: z.number().optional(),
    dataSource: z.enum(['transactions', 'tags']),
    chartType: z.enum(['area', 'bar', 'line']),
});

const chartWidgetConfigSchema = baseWidgetConfigSchema.extend({
    type: z.literal('chart'),
    refreshRate: z.number().optional(),
    dataSource: z.enum(['transactions', 'tags']),
    chartType: z.enum(['pie', 'radar', 'radial']),
});

const widgetConfigSchema = z.discriminatedUnion('type', [
    dataGridWidgetConfigSchema,
    dataChartsWidgetConfigSchema,
    financialSummaryWidgetConfigSchema,
    graphWidgetConfigSchema,
    chartWidgetConfigSchema,
]);

const app = new Hono()
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const [data] = await db
            .select()
            .from(dashboardLayouts)
            .where(eq(dashboardLayouts.userId, auth.userId));

        if (!data) {
            // Return default layout if none exists
            return ctx.json({
                data: {
                    userId: auth.userId,
                    widgets: [],
                },
            });
        }

        const parsed = {
            userId: data.userId,
            widgets: JSON.parse(data.widgetsConfig || '[]'),
        };

        return ctx.json({ data: parsed });
    })
    .patch(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                widgets: z.array(widgetConfigSchema),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const widgetsConfig = JSON.stringify(values.widgets);

            const [existingLayout] = await db
                .select()
                .from(dashboardLayouts)
                .where(eq(dashboardLayouts.userId, auth.userId));

            let data: typeof existingLayout;

            if (existingLayout) {
                [data] = await db
                    .update(dashboardLayouts)
                    .set({
                        widgetsConfig,
                        updatedAt: new Date(),
                    })
                    .where(eq(dashboardLayouts.userId, auth.userId))
                    .returning();
            } else {
                [data] = await db
                    .insert(dashboardLayouts)
                    .values({
                        userId: auth.userId,
                        widgetsConfig,
                        updatedAt: new Date(),
                    })
                    .returning();
            }

            const parsed = {
                userId: data.userId,
                widgets: JSON.parse(data.widgetsConfig || '[]'),
            };

            return ctx.json({ data: parsed });
        },
    );

export default app;
