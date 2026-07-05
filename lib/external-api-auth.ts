import { eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import { db } from '../db/drizzle';
import { apiKeys } from '../db/schema';
import {
    type ApiKeyAuthContext,
    type ApiKeyScope,
    buildMissingApiKeyResult,
    extractBearerApiKey,
    hashApiKey,
    validateApiKeyRecord,
} from './api-keys';

const getClientIp = (ctx: Context) => {
    const forwardedFor = ctx.req.header('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || null;
    }

    return ctx.req.header('x-real-ip') ?? null;
};

export const authenticateExternalApiKey = async ({
    authorizationHeader,
    requiredScopes = [],
    ip = null,
    userAgent = null,
}: {
    authorizationHeader: string | null | undefined;
    requiredScopes?: ApiKeyScope[];
    ip?: string | null;
    userAgent?: string | null;
}) => {
    const apiKey = extractBearerApiKey(authorizationHeader);
    if (!apiKey) {
        return buildMissingApiKeyResult();
    }

    const [record] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, hashApiKey(apiKey)))
        .limit(1);

    const result = validateApiKeyRecord({
        record,
        apiKey,
        requiredScopes,
    });

    if (!result.ok) {
        return result;
    }

    await db
        .update(apiKeys)
        .set({
            lastUsedAt: new Date(),
            lastUsedIp: ip,
            lastUsedUserAgent: userAgent,
            updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, result.context.apiKeyId));

    return result;
};

export const createExternalApiAuthMiddleware =
    (requiredScopes: ApiKeyScope[] = []): MiddlewareHandler =>
    async (ctx, next) => {
        const result = await authenticateExternalApiKey({
            authorizationHeader: ctx.req.header('authorization'),
            requiredScopes,
            ip: getClientIp(ctx),
            userAgent: ctx.req.header('user-agent') ?? null,
        });

        if (!result.ok) {
            return ctx.json(
                {
                    error: result.error,
                    code: result.code,
                },
                result.status,
            );
        }

        ctx.set('externalApiAuth', result.context satisfies ApiKeyAuthContext);
        await next();
    };
