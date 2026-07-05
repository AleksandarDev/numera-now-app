import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildApiKeyCreation,
    extractBearerApiKey,
    hashApiKey,
    serializeApiKey,
    validateApiKeyRecord,
} from '../lib/api-keys.ts';

const now = new Date('2026-07-05T12:00:00.000Z');
const apiKey = 'nn_test_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

const createRecord = (overrides = {}) => {
    const creation = buildApiKeyCreation({
        userId: 'user_123',
        name: 'ERP production',
        scopes: ['ingest:write'],
        now,
        apiKey,
    });

    return {
        apiKey: creation.apiKey,
        record: {
            ...creation.values,
            ...overrides,
        },
    };
};

test('buildApiKeyCreation stores display metadata and hash, not plaintext key', () => {
    const creation = buildApiKeyCreation({
        userId: 'user_123',
        name: 'ERP production',
        scopes: ['ingest:write'],
        now,
        apiKey,
    });

    assert.equal(creation.apiKey, apiKey);
    assert.equal(creation.values.keyHash, hashApiKey(apiKey));
    assert.notEqual(creation.values.keyHash, apiKey);
    assert.equal(creation.values.keyPrefix, apiKey.slice(0, 12));
    assert.equal(creation.values.keySuffix, apiKey.slice(-4));
    assert.equal(JSON.stringify(creation.values).includes(apiKey), false);
});

test('extractBearerApiKey parses only a single bearer token', () => {
    assert.equal(extractBearerApiKey(`Bearer ${apiKey}`), apiKey);
    assert.equal(extractBearerApiKey(`bearer ${apiKey}`), apiKey);
    assert.equal(extractBearerApiKey(null), null);
    assert.equal(extractBearerApiKey(apiKey), null);
    assert.equal(extractBearerApiKey(`Bearer ${apiKey} extra`), null);
});

test('validateApiKeyRecord resolves authenticated context for active key', () => {
    const { record } = createRecord();
    const result = validateApiKeyRecord({
        record,
        apiKey,
        requiredScopes: ['ingest:write'],
        now,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.context, {
        userId: 'user_123',
        apiKeyId: record.id,
        scopes: ['ingest:write'],
        keyName: 'ERP production',
        keyPrefix: record.keyPrefix,
    });
});

test('validateApiKeyRecord rejects invalid, revoked, expired, and underscoped keys', () => {
    const { record } = createRecord();

    assert.deepEqual(
        validateApiKeyRecord({
            record,
            apiKey: 'nn_test_wrong',
            requiredScopes: ['ingest:write'],
            now,
        }),
        {
            ok: false,
            status: 401,
            code: 'invalid_api_key',
            error: 'Invalid API key.',
        },
    );

    assert.deepEqual(
        validateApiKeyRecord({
            record: { ...record, revokedAt: now },
            apiKey,
            requiredScopes: ['ingest:write'],
            now,
        }),
        {
            ok: false,
            status: 401,
            code: 'api_key_revoked',
            error: 'API key has been revoked.',
        },
    );

    assert.deepEqual(
        validateApiKeyRecord({
            record: { ...record, expiresAt: new Date('2026-07-05T11:59:00Z') },
            apiKey,
            requiredScopes: ['ingest:write'],
            now,
        }),
        {
            ok: false,
            status: 401,
            code: 'api_key_expired',
            error: 'API key has expired.',
        },
    );

    assert.deepEqual(
        validateApiKeyRecord({
            record: { ...record, scopes: [] },
            apiKey,
            requiredScopes: ['ingest:write'],
            now,
        }),
        {
            ok: false,
            status: 403,
            code: 'insufficient_scope',
            error: 'API key does not have the required scope.',
        },
    );
});

test('serializeApiKey excludes hash and plaintext key material', () => {
    const { record } = createRecord({
        lastUsedAt: now,
        lastUsedIp: '203.0.113.10',
        lastUsedUserAgent: 'ExampleClient/1.0',
    });

    const serialized = serializeApiKey(record);

    assert.equal('keyHash' in serialized, false);
    assert.equal('apiKey' in serialized, false);
    assert.equal(JSON.stringify(serialized).includes(apiKey), false);
    assert.equal(serialized.lastUsedIp, '203.0.113.10');
    assert.equal(serialized.lastUsedUserAgent, 'ExampleClient/1.0');
});
