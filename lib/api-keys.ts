import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import type { apiKeys } from '../db/schema';

export const API_KEY_SCOPES = ['ingest:write'] as const;
export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ['ingest:write'];

const API_KEY_RANDOM_BYTES = 32;
const API_KEY_PREFIX_LENGTH = 12;
const API_KEY_SUFFIX_LENGTH = 4;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiKeyRow = typeof apiKeys.$inferSelect;

export type SerializedApiKey = {
    id: string;
    name: string;
    keyPrefix: string;
    keySuffix: string;
    scopes: ApiKeyScope[];
    expiresAt: Date | null;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    lastUsedIp: string | null;
    lastUsedUserAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type ApiKeyAuthContext = {
    userId: string;
    apiKeyId: string;
    scopes: ApiKeyScope[];
    keyName: string;
    keyPrefix: string;
};

export type ApiKeyValidationFailureCode =
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'api_key_expired'
    | 'api_key_revoked'
    | 'insufficient_scope';

export type ApiKeyValidationResult =
    | {
          ok: true;
          context: ApiKeyAuthContext;
      }
    | {
          ok: false;
          status: 401 | 403;
          code: ApiKeyValidationFailureCode;
          error: string;
      };

export type ApiKeyCreation = {
    apiKey: string;
    values: typeof apiKeys.$inferInsert;
};

export const generateApiKeyValue = (
    environment = process.env.NODE_ENV,
): string => {
    const environmentSegment = environment === 'production' ? 'live' : 'test';
    return `nn_${environmentSegment}_${randomBytes(API_KEY_RANDOM_BYTES).toString('base64url')}`;
};

export const hashApiKey = (apiKey: string): string =>
    createHash('sha256').update(apiKey).digest('hex');

export const getApiKeyDisplayParts = (apiKey: string) => ({
    keyPrefix: apiKey.slice(0, API_KEY_PREFIX_LENGTH),
    keySuffix: apiKey.slice(-API_KEY_SUFFIX_LENGTH),
});

export const extractBearerApiKey = (
    authorizationHeader: string | null | undefined,
) => {
    if (!authorizationHeader) {
        return null;
    }

    const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
        return null;
    }

    return token;
};

const isApiKeyScope = (scope: unknown): scope is ApiKeyScope =>
    typeof scope === 'string' &&
    (API_KEY_SCOPES as readonly string[]).includes(scope);

export const normalizeApiKeyScopes = (scopes: unknown): ApiKeyScope[] => {
    if (!Array.isArray(scopes)) {
        return [];
    }

    const normalized = scopes.filter(isApiKeyScope);
    return [...new Set(normalized)];
};

export const normalizeRequestedApiKeyScopes = (scopes: unknown) => {
    const normalized = normalizeApiKeyScopes(scopes);
    return normalized.length > 0 ? normalized : [...DEFAULT_API_KEY_SCOPES];
};

export const hasRequiredScopes = (
    scopes: ApiKeyScope[],
    requiredScopes: ApiKeyScope[],
) => requiredScopes.every((scope) => scopes.includes(scope));

const constantTimeEqual = (left: string, right: string) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
};

const isExpired = (expiresAt: Date | null, now: Date) =>
    expiresAt !== null && expiresAt.getTime() <= now.getTime();

export const validateApiKeyRecord = ({
    record,
    apiKey,
    requiredScopes = [],
    now = new Date(),
}: {
    record: ApiKeyRow | null | undefined;
    apiKey: string;
    requiredScopes?: ApiKeyScope[];
    now?: Date;
}): ApiKeyValidationResult => {
    if (!record) {
        return {
            ok: false,
            status: 401,
            code: 'invalid_api_key',
            error: 'Invalid API key.',
        };
    }

    const hashedKey = hashApiKey(apiKey);
    if (!constantTimeEqual(hashedKey, record.keyHash)) {
        return {
            ok: false,
            status: 401,
            code: 'invalid_api_key',
            error: 'Invalid API key.',
        };
    }

    if (record.revokedAt) {
        return {
            ok: false,
            status: 401,
            code: 'api_key_revoked',
            error: 'API key has been revoked.',
        };
    }

    if (isExpired(record.expiresAt, now)) {
        return {
            ok: false,
            status: 401,
            code: 'api_key_expired',
            error: 'API key has expired.',
        };
    }

    const scopes = normalizeApiKeyScopes(record.scopes);
    if (!hasRequiredScopes(scopes, requiredScopes)) {
        return {
            ok: false,
            status: 403,
            code: 'insufficient_scope',
            error: 'API key does not have the required scope.',
        };
    }

    return {
        ok: true,
        context: {
            userId: record.userId,
            apiKeyId: record.id,
            scopes,
            keyName: record.name,
            keyPrefix: record.keyPrefix,
        },
    };
};

export const buildMissingApiKeyResult = (): ApiKeyValidationResult => ({
    ok: false,
    status: 401,
    code: 'missing_api_key',
    error: 'Missing API key.',
});

export const serializeApiKey = (record: ApiKeyRow): SerializedApiKey => ({
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    keySuffix: record.keySuffix,
    scopes: normalizeApiKeyScopes(record.scopes),
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt,
    lastUsedIp: record.lastUsedIp,
    lastUsedUserAgent: record.lastUsedUserAgent,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
});

export const buildApiKeyCreation = ({
    userId,
    name,
    scopes = DEFAULT_API_KEY_SCOPES,
    expiresAt = null,
    now = new Date(),
    apiKey = generateApiKeyValue(),
}: {
    userId: string;
    name: string;
    scopes?: ApiKeyScope[];
    expiresAt?: Date | null;
    now?: Date;
    apiKey?: string;
}): ApiKeyCreation => {
    const { keyPrefix, keySuffix } = getApiKeyDisplayParts(apiKey);

    return {
        apiKey,
        values: {
            id: createId(),
            userId,
            name,
            keyHash: hashApiKey(apiKey),
            keyPrefix,
            keySuffix,
            scopes: normalizeRequestedApiKeyScopes(scopes),
            expiresAt,
            revokedAt: null,
            lastUsedAt: null,
            lastUsedIp: null,
            lastUsedUserAgent: null,
            createdAt: now,
            updatedAt: now,
        },
    };
};
