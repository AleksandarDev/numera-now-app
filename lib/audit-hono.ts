import { getAuth } from '@hono/clerk-auth';
import type { Context, MiddlewareHandler } from 'hono';

import { db } from '@/db/drizzle';
import { writeAuditEvent } from '@/lib/audit';
import { buildMutationAuditEvents } from '@/lib/audit-route-core';

const getAuthenticatedUserId = (ctx: Context) => {
    try {
        return getAuth(ctx)?.userId ?? null;
    } catch {
        return null;
    }
};

const readJsonResponse = async (ctx: Context) => {
    const contentType = ctx.res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return undefined;
    }

    try {
        return await ctx.res.clone().json();
    } catch {
        return undefined;
    }
};

export const auditMutationMiddleware: MiddlewareHandler = async (ctx, next) => {
    await next();

    const userId = getAuthenticatedUserId(ctx);
    if (!userId) {
        return;
    }

    const responseJson = await readJsonResponse(ctx);
    const requestId =
        ctx.req.header('x-request-id') ??
        ctx.req.header('x-vercel-id') ??
        ctx.req.header('cf-ray') ??
        null;

    const events = buildMutationAuditEvents({
        method: ctx.req.method,
        path: ctx.req.path,
        status: ctx.res.status,
        userId,
        requestId,
        responseJson,
    });

    for (const event of events) {
        await writeAuditEvent(db, event);
    }
};
