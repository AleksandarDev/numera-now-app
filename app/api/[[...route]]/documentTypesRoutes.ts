import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { documentTypes, insertDocumentTypeSchema } from '@/db/schema';

const app = new Hono()
    // Get all document types for user
    .get('/', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const data = await db
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.userId, auth.userId));

        return ctx.json({ data });
    })

    // Create a new document type
    .post(
        '/',
        clerkMiddleware(),
        zValidator(
            'json',
            insertDocumentTypeSchema
                .omit({ id: true, userId: true, createdAt: true })
                .extend({
                    name: z.string().min(1, 'Name is required'),
                    description: z.string().optional(),
                    isRequired: z.boolean().default(false),
                }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            // Check if document type with same name already exists for user
            const [existing] = await db
                .select()
                .from(documentTypes)
                .where(
                    and(
                        eq(documentTypes.userId, auth.userId),
                        eq(documentTypes.name, values.name),
                    ),
                );

            if (existing) {
                return ctx.json(
                    { error: 'Document type with this name already exists.' },
                    400,
                );
            }

            try {
                const [data] = await db
                    .insert(documentTypes)
                    .values({
                        id: createId(),
                        userId: auth.userId,
                        ...values,
                    })
                    .returning();

                return ctx.json({ data }, 201);
            } catch (error) {
                console.error('Error creating document type:', error);
                return ctx.json(
                    { error: 'Failed to create document type' },
                    500,
                );
            }
        },
    )

    // Update a document type
    .patch(
        '/:id',
        clerkMiddleware(),
        zValidator(
            'json',
            z.object({
                name: z.string().min(1).optional(),
                description: z.string().optional(),
                isRequired: z.boolean().optional(),
            }),
        ),
        async (ctx) => {
            const auth = getAuth(ctx);
            const { id } = ctx.req.param();
            const values = ctx.req.valid('json');

            if (!auth?.userId) {
                return ctx.json({ error: 'Unauthorized.' }, 401);
            }

            try {
                const [data] = await db
                    .update(documentTypes)
                    .set(values)
                    .where(
                        and(
                            eq(documentTypes.id, id),
                            eq(documentTypes.userId, auth.userId),
                        ),
                    )
                    .returning();

                if (!data) {
                    return ctx.json({ error: 'Document type not found.' }, 404);
                }

                return ctx.json({ data });
            } catch (error) {
                console.error('Error updating document type:', error);
                return ctx.json(
                    { error: 'Failed to update document type' },
                    500,
                );
            }
        },
    )

    // Delete a document type
    .delete('/:id', clerkMiddleware(), async (ctx) => {
        const auth = getAuth(ctx);
        const { id } = ctx.req.param();

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        try {
            // Check if document type is in use
            // This would require a check in the documents table
            const [data] = await db
                .delete(documentTypes)
                .where(
                    and(
                        eq(documentTypes.id, id),
                        eq(documentTypes.userId, auth.userId),
                    ),
                )
                .returning();

            if (!data) {
                return ctx.json({ error: 'Document type not found.' }, 404);
            }

            return ctx.json({ data });
        } catch (error) {
            console.error('Error deleting document type:', error);
            return ctx.json({ error: 'Failed to delete document type' }, 500);
        }
    });

export default app;
