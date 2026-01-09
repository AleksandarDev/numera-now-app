import { Redis } from '@upstash/redis';
import { type Context, Hono } from 'hono';
import { handle } from 'hono/vercel';

import accountsRoutes from './accountsRoutes';
import customersRoutes from './customersRoutes';
import dashboardRoutes from './dashboardRoutes';
import documentsRoutes from './documentsRoutes';
import documentTypesRoutes from './documentTypesRoutes';
import openFinancesRoutes from './openFinancesRoutes';
import settingsRoutes from './settingsRoutes';
import stripeRoutes from './stripeRoutes';
import summaryRoutes from './summaryRoutes';
import tagsRoutes from './tagsRoutes';
import transactionsRoutes from './transactionsRoutes';

const app = new Hono().basePath('/api');
const RATE_LIMIT_WINDOW_MS = Number(
    process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000,
);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 1000);
const redisUrl =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redisClient =
    redisUrl && redisToken
        ? new Redis({ url: redisUrl, token: redisToken })
        : null;
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

const getClientKey = (ctx: Context) => {
    const forwardedFor = ctx.req.header('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    return ctx.req.header('x-real-ip') ?? 'unknown';
};

app.use('*', async (ctx, next) => {
    const now = Date.now();
    const key = getClientKey(ctx);
    const bucketKey = `rate-limit:${key}`;

    if (redisClient) {
        const count = await redisClient.incr(bucketKey);
        if (count === 1) {
            await redisClient.pexpire(bucketKey, RATE_LIMIT_WINDOW_MS);
        }
        const ttlMs = await redisClient.pttl(bucketKey);
        if (count > RATE_LIMIT_MAX) {
            const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
            ctx.header('Retry-After', String(retryAfterSeconds));
            return ctx.json({ error: 'Too many requests.' }, 429);
        }
    } else {
        const entry = inMemoryStore.get(bucketKey);
        const resetAt = entry?.resetAt ?? 0;
        const current =
            !entry || resetAt <= now
                ? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
                : entry;

        current.count += 1;
        inMemoryStore.set(bucketKey, current);

        if (inMemoryStore.size > 10000) {
            for (const [storedKey, storedEntry] of inMemoryStore) {
                if (storedEntry.resetAt <= now) {
                    inMemoryStore.delete(storedKey);
                }
            }
        }

        if (current.count > RATE_LIMIT_MAX) {
            const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
            ctx.header('Retry-After', String(retryAfterSeconds));
            return ctx.json({ error: 'Too many requests.' }, 429);
        }
    }

    await next();
});

const routes = app
    .route('/accounts', accountsRoutes)
    .route('/customers', customersRoutes)
    .route('/dashboard', dashboardRoutes)
    .route('/summary', summaryRoutes)
    .route('/transactions', transactionsRoutes)
    .route('/settings', settingsRoutes)
    .route('/documents', documentsRoutes)
    .route('/document-types', documentTypesRoutes)
    .route('/stripe', stripeRoutes)
    .route('/tags', tagsRoutes)
    .route('/open-finances', openFinancesRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
