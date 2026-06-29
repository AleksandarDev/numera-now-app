import { clerkMiddleware, getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { listAuditEvents } from '@/lib/services/finance-entities';

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

        const data = await listAuditEvents({
            userId: auth.userId,
            ...query,
        });

        return ctx.json({ data });
    },
);

export default app;
