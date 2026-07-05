import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@/db/drizzle';
import { apiKeys } from '@/db/schema';
import {
    API_KEY_SCOPES,
    buildApiKeyCreation,
    serializeApiKey,
} from '@/lib/api-keys';

const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

const createApiKeySchema = z.object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(apiKeyScopeSchema).min(1).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
});

const parseOptionalExpiration = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    return new Date(value);
};

const app = new Hono()
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const rows = await db
            .select()
            .from(apiKeys)
            .where(eq(apiKeys.userId, auth.userId))
            .orderBy(desc(apiKeys.createdAt));

        return ctx.json({ data: rows.map(serializeApiKey) });
    })
    .post(
        '/',
        clerkMiddleware(),
        zValidator('json', createApiKeySchema),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const expiresAt = parseOptionalExpiration(values.expiresAt);
            if (expiresAt && expiresAt.getTime() <= Date.now()) {
                return ctx.json(
                    { error: 'Expiration must be in the future.' },
                    400,
                );
            }

            const creation = buildApiKeyCreation({
                userId: auth.userId,
                name: values.name,
                scopes: values.scopes,
                expiresAt,
            });

            const [created] = await db
                .insert(apiKeys)
                .values(creation.values)
                .returning();

            return ctx.json(
                {
                    data: serializeApiKey(created),
                    apiKey: creation.apiKey,
                },
                201,
            );
        },
    )
    .delete(
        '/:id',
        clerkMiddleware(),
        zValidator('param', z.object({ id: z.string().min(1) })),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [existing] = await db
                .select()
                .from(apiKeys)
                .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, auth.userId)))
                .limit(1);

            if (!existing) {
                return ctx.json({ error: 'API key not found.' }, 404);
            }

            if (existing.revokedAt) {
                return ctx.json({ data: serializeApiKey(existing) });
            }

            const [revoked] = await db
                .update(apiKeys)
                .set({
                    revokedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, auth.userId)))
                .returning();

            return ctx.json({ data: serializeApiKey(revoked) });
        },
    );

export default app;
