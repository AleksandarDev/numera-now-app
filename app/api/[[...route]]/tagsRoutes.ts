import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { insertTagSchema, tags } from '@/db/schema';

const app = new Hono()
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const data = await db
            .select({
                id: tags.id,
                name: tags.name,
                color: tags.color,
            })
            .from(tags)
            .where(eq(tags.userId, auth.userId));

        return ctx.json({ data });
    })
    .get(
        '/:id',
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        clerkMiddleware(),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .select({
                    id: tags.id,
                    name: tags.name,
                    color: tags.color,
                })
                .from(tags)
                .where(and(eq(tags.userId, auth.userId), eq(tags.id, id)));

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .post(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            insertTagSchema.pick({
                name: true,
                color: true,
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .insert(tags)
                .values({
                    id: createId(),
                    userId: auth.userId,
                    ...values,
                })
                .returning();

            return ctx.json({ data });
        },
    )
    .post(
        '/bulk-delete',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                ids: z.array(z.string()),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const data = await db
                .delete(tags)
                .where(
                    and(
                        eq(tags.userId, auth.userId),
                        inArray(tags.id, values.ids),
                    ),
                )
                .returning({
                    id: tags.id,
                });

            return ctx.json({ data });
        },
    )
    .patch(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        zValidator(
            'json',
            insertTagSchema.pick({
                name: true,
                color: true,
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');
            const values = ctx.req.valid('json');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .update(tags)
                .set(values)
                .where(and(eq(tags.userId, auth.userId), eq(tags.id, id)))
                .returning();

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    )
    .delete(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'param',
            z.object({
                id: z.string().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.valid('param');

            if (!id) {
                return ctx.json({ error: 'Missing id.' }, 400);
            }

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            const [data] = await db
                .delete(tags)
                .where(and(eq(tags.userId, auth.userId), eq(tags.id, id)))
                .returning({
                    id: tags.id,
                });

            if (!data) {
                return ctx.json({ error: 'Not found.' }, 404);
            }

            return ctx.json({ data });
        },
    );

export default app;
