import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, lte } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '../db/drizzle.ts';
import { externalIngestIdempotencyRecords } from '../db/schema.ts';
import type { ApiKeyAuthContext } from './api-keys.ts';

export const EXTERNAL_INGEST_AUDIT_SOURCE = 'external_api';
export const DEFAULT_EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS = 30;
export const DEFAULT_EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_EXTERNAL_INGEST_RATE_LIMIT_MAX = 120;

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS = parsePositiveNumber(
    process.env.EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS,
    DEFAULT_EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS,
);
export const EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS = parsePositiveNumber(
    process.env.EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS,
    DEFAULT_EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS,
);
export const EXTERNAL_INGEST_RATE_LIMIT_MAX = parsePositiveNumber(
    process.env.EXTERNAL_INGEST_RATE_LIMIT_MAX,
    DEFAULT_EXTERNAL_INGEST_RATE_LIMIT_MAX,
);

export type ExternalIngestJson =
    | null
    | string
    | number
    | boolean
    | ExternalIngestJson[]
    | { [key: string]: ExternalIngestJson };

export type ExternalIngestIdempotencyStatus =
    | 'processing'
    | 'completed'
    | 'failed';

export type ExternalIngestResponseSnapshot = {
    status: number;
    body: ExternalIngestJson;
};

export type ExternalIngestIdempotencyRecord = {
    id: string;
    userId: string;
    apiKeyId: string;
    idempotencyKey: string;
    method: string;
    path: string;
    requestHash: string;
    sourceSystem: string | null;
    externalId: string | null;
    requestId: string | null;
    status: ExternalIngestIdempotencyStatus;
    responseStatus: number | null;
    responseBody: ExternalIngestJson | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type ExternalIngestIdempotencyRequest = {
    userId: string;
    apiKeyId: string;
    idempotencyKey: string;
    method: string;
    path: string;
    body: unknown;
    sourceSystem?: string | null;
    externalId?: string | null;
    requestId?: string | null;
    now?: Date;
    retentionMs?: number;
};

export type ExternalIngestIdempotencyStore = {
    findByIdempotencyKey: (input: {
        apiKeyId: string;
        method: string;
        path: string;
        idempotencyKey: string;
    }) => Promise<ExternalIngestIdempotencyRecord | null>;
    findByExternalId: (input: {
        userId: string;
        method: string;
        path: string;
        sourceSystem: string;
        externalId: string;
    }) => Promise<ExternalIngestIdempotencyRecord | null>;
    create: (input: {
        userId: string;
        apiKeyId: string;
        idempotencyKey: string;
        method: string;
        path: string;
        requestHash: string;
        sourceSystem: string | null;
        externalId: string | null;
        requestId: string | null;
        expiresAt: Date;
        now: Date;
    }) => Promise<ExternalIngestIdempotencyRecord>;
    complete: (input: {
        id: string;
        responseStatus: number;
        responseBody: ExternalIngestJson;
        now: Date;
    }) => Promise<ExternalIngestIdempotencyRecord>;
    markFailed?: (input: {
        id: string;
        now: Date;
    }) => Promise<ExternalIngestIdempotencyRecord>;
    deleteExpired?: (input: { now: Date }) => Promise<number>;
};

export type ExternalIngestIdempotencyExecution =
    | {
          kind: 'created' | 'replay';
          idempotentReplay: boolean;
          record: ExternalIngestIdempotencyRecord;
          response: ExternalIngestResponseSnapshot;
      }
    | {
          kind: 'conflict' | 'invalid_request' | 'in_progress';
          idempotentReplay: false;
          record?: ExternalIngestIdempotencyRecord;
          response: ExternalIngestResponseSnapshot;
      };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const normalizeStableJson = (value: unknown): ExternalIngestJson => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(normalizeStableJson);
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, normalizeStableJson(entry)]),
        );
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    return String(value);
};

const normalizeNullableString = (value: string | null | undefined) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const normalizeMethod = (method: string) => method.trim().toUpperCase();

const createSha256 = (value: string) =>
    createHash('sha256').update(value).digest('hex');

export const stableStringifyExternalIngestPayload = (value: unknown) =>
    JSON.stringify(normalizeStableJson(value));

export const createExternalIngestRequestHash = ({
    method,
    path,
    body,
}: {
    method: string;
    path: string;
    body: unknown;
}) =>
    createSha256(
        stableStringifyExternalIngestPayload({
            method: normalizeMethod(method),
            path,
            body,
        }),
    );

export const hashExternalIngestIdempotencyKey = (idempotencyKey: string) =>
    createSha256(idempotencyKey);

export const getExternalIngestRetentionPolicy = () => ({
    retentionDays: EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS,
    cleanup:
        'Expired external ingest idempotency records may be deleted after the retention window; the DB store deletes expired records before reserving new requests.',
});

export const getExternalIngestIdempotencyExpiresAt = ({
    now = new Date(),
    retentionMs,
}: {
    now?: Date;
    retentionMs?: number;
} = {}) =>
    new Date(
        now.getTime() +
            (retentionMs ??
                EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS *
                    24 *
                    60 *
                    60 *
                    1000),
    );

export const buildExternalIngestAuditSourceMetadata = ({
    apiKeyId,
    sourceSystem,
    externalId,
    ingestEventId,
    requestId,
    idempotencyKey,
}: {
    apiKeyId?: string | null;
    sourceSystem?: string | null;
    externalId?: string | null;
    ingestEventId?: string | null;
    requestId?: string | null;
    idempotencyKey?: string | null;
}) => ({
    source: EXTERNAL_INGEST_AUDIT_SOURCE,
    apiKeyId: apiKeyId ?? null,
    sourceSystem: normalizeNullableString(sourceSystem),
    externalId: normalizeNullableString(externalId),
    ingestEventId: ingestEventId ?? null,
    requestId: normalizeNullableString(requestId),
    idempotencyKeyHash: idempotencyKey
        ? hashExternalIngestIdempotencyKey(idempotencyKey)
        : null,
});

export const buildExternalIngestSourceContext = ({
    auth,
    sourceSystem,
    externalId,
    ingestEventId,
    requestId,
}: {
    auth: ApiKeyAuthContext;
    sourceSystem?: string | null;
    externalId?: string | null;
    ingestEventId?: string | null;
    requestId?: string | null;
}) => ({
    source: EXTERNAL_INGEST_AUDIT_SOURCE,
    actorUserId: auth.userId,
    actorType: 'integration' as const,
    apiKeyId: auth.apiKeyId,
    sourceSystem: normalizeNullableString(sourceSystem),
    externalId: normalizeNullableString(externalId),
    ingestEventId: ingestEventId ?? null,
    requestId: normalizeNullableString(requestId),
});

const toIdempotencyRecord = (
    record: typeof externalIngestIdempotencyRecords.$inferSelect,
): ExternalIngestIdempotencyRecord => ({
    ...record,
    status: record.status as ExternalIngestIdempotencyStatus,
    responseBody: record.responseBody as ExternalIngestJson | null,
});

export const defaultExternalIngestIdempotencyStore: ExternalIngestIdempotencyStore =
    {
        findByIdempotencyKey: async ({
            apiKeyId,
            method,
            path,
            idempotencyKey,
        }) => {
            const [record] = await db
                .select()
                .from(externalIngestIdempotencyRecords)
                .where(
                    and(
                        eq(externalIngestIdempotencyRecords.apiKeyId, apiKeyId),
                        eq(
                            externalIngestIdempotencyRecords.method,
                            normalizeMethod(method),
                        ),
                        eq(externalIngestIdempotencyRecords.path, path),
                        eq(
                            externalIngestIdempotencyRecords.idempotencyKey,
                            idempotencyKey,
                        ),
                    ),
                )
                .limit(1);

            return record ? toIdempotencyRecord(record) : null;
        },
        findByExternalId: async ({
            userId,
            method,
            path,
            sourceSystem,
            externalId,
        }) => {
            const [record] = await db
                .select()
                .from(externalIngestIdempotencyRecords)
                .where(
                    and(
                        eq(externalIngestIdempotencyRecords.userId, userId),
                        eq(
                            externalIngestIdempotencyRecords.method,
                            normalizeMethod(method),
                        ),
                        eq(externalIngestIdempotencyRecords.path, path),
                        eq(
                            externalIngestIdempotencyRecords.sourceSystem,
                            sourceSystem,
                        ),
                        eq(
                            externalIngestIdempotencyRecords.externalId,
                            externalId,
                        ),
                    ),
                )
                .limit(1);

            return record ? toIdempotencyRecord(record) : null;
        },
        create: async (input) => {
            const [record] = await db
                .insert(externalIngestIdempotencyRecords)
                .values({
                    id: createId(),
                    userId: input.userId,
                    apiKeyId: input.apiKeyId,
                    idempotencyKey: input.idempotencyKey,
                    method: normalizeMethod(input.method),
                    path: input.path,
                    requestHash: input.requestHash,
                    sourceSystem: input.sourceSystem,
                    externalId: input.externalId,
                    requestId: input.requestId,
                    status: 'processing',
                    responseStatus: null,
                    responseBody: null,
                    expiresAt: input.expiresAt,
                    createdAt: input.now,
                    updatedAt: input.now,
                })
                .returning();

            return toIdempotencyRecord(record);
        },
        complete: async ({ id, responseStatus, responseBody, now }) => {
            const [record] = await db
                .update(externalIngestIdempotencyRecords)
                .set({
                    status: 'completed',
                    responseStatus,
                    responseBody,
                    updatedAt: now,
                })
                .where(eq(externalIngestIdempotencyRecords.id, id))
                .returning();

            return toIdempotencyRecord(record);
        },
        markFailed: async ({ id, now }) => {
            const [record] = await db
                .update(externalIngestIdempotencyRecords)
                .set({
                    status: 'failed',
                    updatedAt: now,
                })
                .where(eq(externalIngestIdempotencyRecords.id, id))
                .returning();

            return toIdempotencyRecord(record);
        },
        deleteExpired: async ({ now }) => {
            const deleted = await db
                .delete(externalIngestIdempotencyRecords)
                .where(lte(externalIngestIdempotencyRecords.expiresAt, now))
                .returning({ id: externalIngestIdempotencyRecords.id });

            return deleted.length;
        },
    };

const hasCompletedResponse = (record: ExternalIngestIdempotencyRecord) =>
    record.status === 'completed' && record.responseStatus !== null;

const markIdempotentReplay = (
    body: ExternalIngestJson | null,
): ExternalIngestJson => {
    if (!isPlainObject(body)) {
        return body;
    }

    const data = body.data;
    if (!isPlainObject(data)) {
        return body;
    }

    return {
        ...body,
        data: {
            ...data,
            idempotentReplay: true,
        },
    } as ExternalIngestJson;
};

const buildExternalIngestErrorResponse = ({
    status,
    code,
    message,
    requestId,
}: {
    status: number;
    code: string;
    message: string;
    requestId?: string | null;
}): ExternalIngestResponseSnapshot => ({
    status,
    body: {
        error: {
            code,
            message,
            requestId: requestId ?? null,
        },
    },
});

export const withExternalIngestIdempotency = async (
    request: ExternalIngestIdempotencyRequest,
    handler: (
        record: ExternalIngestIdempotencyRecord,
    ) => Promise<ExternalIngestResponseSnapshot>,
    store: ExternalIngestIdempotencyStore = defaultExternalIngestIdempotencyStore,
): Promise<ExternalIngestIdempotencyExecution> => {
    const now = request.now ?? new Date();
    const idempotencyKey = normalizeNullableString(request.idempotencyKey);
    const method = normalizeMethod(request.method);
    const sourceSystem = normalizeNullableString(request.sourceSystem);
    const externalId = normalizeNullableString(request.externalId);
    const requestId = normalizeNullableString(request.requestId);

    if (!idempotencyKey) {
        return {
            kind: 'invalid_request',
            idempotentReplay: false,
            response: buildExternalIngestErrorResponse({
                status: 400,
                code: 'invalid_request',
                message:
                    'Idempotency-Key is required for external ingest writes.',
                requestId,
            }),
        };
    }

    await store.deleteExpired?.({ now });

    const requestHash = createExternalIngestRequestHash({
        method,
        path: request.path,
        body: request.body,
    });
    const existingForKey = await store.findByIdempotencyKey({
        apiKeyId: request.apiKeyId,
        method,
        path: request.path,
        idempotencyKey,
    });

    if (existingForKey) {
        if (existingForKey.requestHash !== requestHash) {
            return {
                kind: 'conflict',
                idempotentReplay: false,
                record: existingForKey,
                response: buildExternalIngestErrorResponse({
                    status: 409,
                    code: 'idempotency_conflict',
                    message:
                        'Idempotency-Key was already used with a different request.',
                    requestId,
                }),
            };
        }

        if (hasCompletedResponse(existingForKey)) {
            return {
                kind: 'replay',
                idempotentReplay: true,
                record: existingForKey,
                response: {
                    status: existingForKey.responseStatus ?? 200,
                    body: markIdempotentReplay(existingForKey.responseBody),
                },
            };
        }

        return {
            kind: 'in_progress',
            idempotentReplay: false,
            record: existingForKey,
            response: buildExternalIngestErrorResponse({
                status: 409,
                code: 'idempotency_in_progress',
                message:
                    'Idempotency-Key is already being processed. Retry after the first request completes.',
                requestId,
            }),
        };
    }

    if (sourceSystem && externalId) {
        const existingForExternalId = await store.findByExternalId({
            userId: request.userId,
            method,
            path: request.path,
            sourceSystem,
            externalId,
        });

        if (existingForExternalId) {
            if (
                existingForExternalId.requestHash === requestHash &&
                hasCompletedResponse(existingForExternalId)
            ) {
                return {
                    kind: 'replay',
                    idempotentReplay: true,
                    record: existingForExternalId,
                    response: {
                        status: existingForExternalId.responseStatus ?? 200,
                        body: markIdempotentReplay(
                            existingForExternalId.responseBody,
                        ),
                    },
                };
            }

            return {
                kind: 'conflict',
                idempotentReplay: false,
                record: existingForExternalId,
                response: buildExternalIngestErrorResponse({
                    status: 409,
                    code: 'duplicate_external_id',
                    message:
                        'externalId was already used for this source system and endpoint.',
                    requestId,
                }),
            };
        }
    }

    const record = await store.create({
        userId: request.userId,
        apiKeyId: request.apiKeyId,
        idempotencyKey,
        method,
        path: request.path,
        requestHash,
        sourceSystem,
        externalId,
        requestId,
        expiresAt: getExternalIngestIdempotencyExpiresAt({
            now,
            retentionMs: request.retentionMs,
        }),
        now,
    });

    try {
        const response = await handler(record);
        const completedRecord = await store.complete({
            id: record.id,
            responseStatus: response.status,
            responseBody: response.body,
            now,
        });

        return {
            kind: 'created',
            idempotentReplay: false,
            record: completedRecord,
            response,
        };
    } catch (error) {
        await store.markFailed?.({ id: record.id, now });
        throw error;
    }
};

export type ExternalIngestRateLimitStore = {
    increment: (input: {
        key: string;
        windowMs: number;
        now: Date;
    }) => Promise<{
        count: number;
        resetAt: Date;
    }>;
};

export type ExternalIngestRateLimitDecision =
    | {
          allowed: true;
          key: string;
          limit: number;
          remaining: number;
          resetAt: Date;
      }
    | {
          allowed: false;
          key: string;
          limit: number;
          remaining: 0;
          resetAt: Date;
          retryAfterSeconds: number;
          response: ExternalIngestResponseSnapshot;
      };

export const createInMemoryExternalIngestRateLimitStore =
    (): ExternalIngestRateLimitStore => {
        const buckets = new Map<string, { count: number; resetAt: number }>();

        return {
            increment: async ({ key, windowMs, now }) => {
                const existing = buckets.get(key);
                const current =
                    !existing || existing.resetAt <= now.getTime()
                        ? { count: 0, resetAt: now.getTime() + windowMs }
                        : existing;

                current.count += 1;
                buckets.set(key, current);

                if (buckets.size > 10_000) {
                    for (const [bucketKey, bucket] of buckets) {
                        if (bucket.resetAt <= now.getTime()) {
                            buckets.delete(bucketKey);
                        }
                    }
                }

                return {
                    count: current.count,
                    resetAt: new Date(current.resetAt),
                };
            },
        };
    };

export type ExternalIngestRedisRateLimitClient = {
    incr: (key: string) => Promise<number>;
    pexpire: (key: string, milliseconds: number) => Promise<unknown>;
    pttl: (key: string) => Promise<number>;
};

export const createExternalIngestRedisRateLimitStore = (
    redis: ExternalIngestRedisRateLimitClient,
): ExternalIngestRateLimitStore => ({
    increment: async ({ key, windowMs, now }) => {
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.pexpire(key, windowMs);
        }

        const ttlMs = await redis.pttl(key);
        return {
            count,
            resetAt: new Date(now.getTime() + (ttlMs > 0 ? ttlMs : windowMs)),
        };
    },
});

export const defaultExternalIngestRateLimitStore =
    createInMemoryExternalIngestRateLimitStore();

export const getExternalIngestRateLimitKey = (auth: {
    userId: string;
    apiKeyId?: string | null;
}) =>
    auth.apiKeyId
        ? `external-ingest:api-key:${auth.apiKeyId}`
        : `external-ingest:user:${auth.userId}`;

export const checkExternalIngestRateLimit = async ({
    auth,
    store = defaultExternalIngestRateLimitStore,
    limit = EXTERNAL_INGEST_RATE_LIMIT_MAX,
    windowMs = EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS,
    now = new Date(),
}: {
    auth: { userId: string; apiKeyId?: string | null };
    store?: ExternalIngestRateLimitStore;
    limit?: number;
    windowMs?: number;
    now?: Date;
}): Promise<ExternalIngestRateLimitDecision> => {
    const key = getExternalIngestRateLimitKey(auth);
    const bucket = await store.increment({ key, windowMs, now });
    const remaining = Math.max(0, limit - bucket.count);

    if (bucket.count <= limit) {
        return {
            allowed: true,
            key,
            limit,
            remaining,
            resetAt: bucket.resetAt,
        };
    }

    const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000),
    );

    return {
        allowed: false,
        key,
        limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds,
        response: {
            status: 429,
            body: {
                error: {
                    code: 'rate_limited',
                    message: 'Too many external ingest requests.',
                    retryAfterSeconds,
                    resetAt: bucket.resetAt.toISOString(),
                },
            },
        },
    };
};

export const createExternalIngestRateLimitMiddleware =
    ({
        store = defaultExternalIngestRateLimitStore,
        limit = EXTERNAL_INGEST_RATE_LIMIT_MAX,
        windowMs = EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS,
    }: {
        store?: ExternalIngestRateLimitStore;
        limit?: number;
        windowMs?: number;
    } = {}): MiddlewareHandler =>
    async (ctx, next) => {
        const auth = ctx.get('externalApiAuth') as
            | ApiKeyAuthContext
            | undefined;

        if (!auth) {
            return ctx.json(
                {
                    error: {
                        code: 'unauthorized',
                        message:
                            'External API authentication is required before rate limiting.',
                    },
                },
                401,
            );
        }

        const decision = await checkExternalIngestRateLimit({
            auth,
            store,
            limit,
            windowMs,
        });

        ctx.header('X-RateLimit-Limit', String(decision.limit));
        ctx.header('X-RateLimit-Remaining', String(decision.remaining));
        ctx.header(
            'X-RateLimit-Reset',
            String(Math.ceil(decision.resetAt.getTime() / 1000)),
        );

        if (!decision.allowed) {
            ctx.header('Retry-After', String(decision.retryAfterSeconds));
            return ctx.json(
                decision.response.body as Record<string, unknown>,
                429,
            );
        }

        await next();
    };
