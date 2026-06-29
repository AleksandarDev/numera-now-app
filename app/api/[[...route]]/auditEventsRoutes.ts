import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '@/db/drizzle';
import { auditEvents } from '@/db/schema';
import {
    normalizeAuditEventDate,
    normalizeAuditEventLimit,
    normalizeAuditEventSource,
} from '@/lib/audit-query';

const auditEventQuerySchema = z.object({
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    actorUserId: z.string().optional(),
    actorType: z.enum(['user', 'system', 'integration']).optional(),
    action: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    source: z.string().optional(),
    limit: z.coerce.number().optional(),
});

const app = new Hono().get(
    '/',
    clerkMiddleware(),
    zValidator('query', auditEventQuerySchema),
    async (ctx) => {
        const auth = getAuth(ctx);
        const query = ctx.req.valid('query');

        if (!auth?.userId) {
            return ctx.json({ error: 'Unauthorized.' }, 401);
        }

        const source = normalizeAuditEventSource(query.source);
        const from = normalizeAuditEventDate(query.from);
        const to = normalizeAuditEventDate(query.to);

        const conditions = [eq(auditEvents.userId, auth.userId)];

        if (query.resourceType) {
            conditions.push(eq(auditEvents.resourceType, query.resourceType));
        }

        if (query.resourceId) {
            conditions.push(eq(auditEvents.resourceId, query.resourceId));
        }

        if (query.actorUserId) {
            conditions.push(eq(auditEvents.actorUserId, query.actorUserId));
        }

        if (query.actorType) {
            conditions.push(eq(auditEvents.actorType, query.actorType));
        }

        if (query.action) {
            conditions.push(eq(auditEvents.action, query.action));
        }

        if (from) {
            conditions.push(gte(auditEvents.createdAt, from));
        }

        if (to) {
            conditions.push(lte(auditEvents.createdAt, to));
        }

        if (source) {
            conditions.push(
                sql`${auditEvents.sourceMetadata}->>'source' = ${source}`,
            );
        }

        const data = await db
            .select()
            .from(auditEvents)
            .where(and(...conditions))
            .orderBy(desc(auditEvents.createdAt))
            .limit(normalizeAuditEventLimit(query.limit));

        return ctx.json({ data });
    },
);

export default app;
