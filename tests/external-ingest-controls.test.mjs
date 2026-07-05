import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/db';
delete process.env.EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS;
delete process.env.EXTERNAL_INGEST_RATE_LIMIT_MAX;
delete process.env.EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS;

const {
    buildExternalIngestAuditSourceMetadata,
    buildExternalIngestSourceContext,
    checkExternalIngestRateLimit,
    createExternalIngestRequestHash,
    createInMemoryExternalIngestRateLimitStore,
    getExternalIngestRetentionPolicy,
    hashExternalIngestIdempotencyKey,
    withExternalIngestIdempotency,
} = await import('../lib/external-ingest-controls.ts');
const { AUDIT_REDACTED_VALUE, buildAuditEventValues } = await import(
    '../lib/audit-core.ts'
);

const now = new Date('2026-07-05T12:00:00.000Z');
const baseRequest = {
    userId: 'user_123',
    apiKeyId: 'key_123',
    idempotencyKey: 'idem-1',
    method: 'post',
    path: '/api/external/v1/invoices',
    sourceSystem: 'acme-erp',
    externalId: 'invoice-1',
    requestId: 'req_1',
    now,
    body: {
        document: {
            totalAmount: '125.40',
            issueDate: '2026-07-05',
        },
        externalId: 'invoice-1',
        sourceSystem: 'acme-erp',
    },
};

const createIdempotencyStore = () => {
    const records = [];

    const findById = (id) => records.find((record) => record.id === id);

    return {
        records,
        store: {
            findByIdempotencyKey: async ({
                apiKeyId,
                method,
                path,
                idempotencyKey,
            }) =>
                records.find(
                    (record) =>
                        record.apiKeyId === apiKeyId &&
                        record.method === method &&
                        record.path === path &&
                        record.idempotencyKey === idempotencyKey,
                ) ?? null,
            findByExternalId: async ({
                userId,
                method,
                path,
                sourceSystem,
                externalId,
            }) =>
                records.find(
                    (record) =>
                        record.userId === userId &&
                        record.method === method &&
                        record.path === path &&
                        record.sourceSystem === sourceSystem &&
                        record.externalId === externalId,
                ) ?? null,
            create: async (input) => {
                const record = {
                    id: `ing_${records.length + 1}`,
                    ...input,
                    status: 'processing',
                    responseStatus: null,
                    responseBody: null,
                    createdAt: input.now,
                    updatedAt: input.now,
                };
                records.push(record);
                return record;
            },
            complete: async ({ id, responseStatus, responseBody, now }) => {
                const record = findById(id);
                Object.assign(record, {
                    status: 'completed',
                    responseStatus,
                    responseBody,
                    updatedAt: now,
                });
                return record;
            },
            markFailed: async ({ id, now }) => {
                const record = findById(id);
                Object.assign(record, {
                    status: 'failed',
                    updatedAt: now,
                });
                return record;
            },
            deleteExpired: async ({ now }) => {
                const before = records.length;
                for (let index = records.length - 1; index >= 0; index--) {
                    if (records[index].expiresAt.getTime() <= now.getTime()) {
                        records.splice(index, 1);
                    }
                }
                return before - records.length;
            },
        },
    };
};

test('createExternalIngestRequestHash is stable for equivalent JSON bodies', () => {
    const left = createExternalIngestRequestHash({
        method: 'post',
        path: '/api/external/v1/invoices',
        body: {
            b: 2,
            a: 1,
            nested: { z: true, c: 'value' },
        },
    });
    const right = createExternalIngestRequestHash({
        method: 'POST',
        path: '/api/external/v1/invoices',
        body: {
            nested: { c: 'value', z: true },
            a: 1,
            b: 2,
        },
    });
    const different = createExternalIngestRequestHash({
        method: 'POST',
        path: '/api/external/v1/receipts',
        body: {
            nested: { c: 'value', z: true },
            a: 1,
            b: 2,
        },
    });

    assert.equal(left, right);
    assert.notEqual(left, different);
});

test('withExternalIngestIdempotency stores accepted responses and replays safe retries', async () => {
    const { records, store } = createIdempotencyStore();
    let handlerCalls = 0;

    const created = await withExternalIngestIdempotency(
        baseRequest,
        async (record) => {
            handlerCalls++;
            return {
                status: 201,
                body: {
                    data: {
                        ingestEventId: record.id,
                        idempotentReplay: false,
                        transaction: { id: 'txn_1' },
                    },
                },
            };
        },
        store,
    );
    const replay = await withExternalIngestIdempotency(
        {
            ...baseRequest,
            body: {
                sourceSystem: 'acme-erp',
                externalId: 'invoice-1',
                document: {
                    issueDate: '2026-07-05',
                    totalAmount: '125.40',
                },
            },
        },
        async () => {
            throw new Error('handler should not run for replay');
        },
        store,
    );

    assert.equal(handlerCalls, 1);
    assert.equal(records.length, 1);
    assert.equal(created.kind, 'created');
    assert.equal(replay.kind, 'replay');
    assert.equal(replay.response.status, 201);
    assert.equal(replay.response.body.data.idempotentReplay, true);
    assert.equal(replay.response.body.data.transaction.id, 'txn_1');
});

test('withExternalIngestIdempotency returns clear conflicts for reused keys and incompatible external IDs', async () => {
    const { store } = createIdempotencyStore();
    await withExternalIngestIdempotency(
        baseRequest,
        async (record) => ({
            status: 201,
            body: {
                data: {
                    ingestEventId: record.id,
                    idempotentReplay: false,
                },
            },
        }),
        store,
    );

    const idempotencyConflict = await withExternalIngestIdempotency(
        {
            ...baseRequest,
            body: {
                ...baseRequest.body,
                document: {
                    ...baseRequest.body.document,
                    totalAmount: '999.00',
                },
            },
        },
        async () => {
            throw new Error('handler should not run for conflict');
        },
        store,
    );
    const duplicateExternalId = await withExternalIngestIdempotency(
        {
            ...baseRequest,
            idempotencyKey: 'idem-2',
            body: {
                ...baseRequest.body,
                document: {
                    ...baseRequest.body.document,
                    totalAmount: '999.00',
                },
            },
        },
        async () => {
            throw new Error('handler should not run for duplicate external ID');
        },
        store,
    );

    assert.equal(idempotencyConflict.kind, 'conflict');
    assert.equal(idempotencyConflict.response.status, 409);
    assert.equal(
        idempotencyConflict.response.body.error.code,
        'idempotency_conflict',
    );
    assert.equal(duplicateExternalId.kind, 'conflict');
    assert.equal(duplicateExternalId.response.status, 409);
    assert.equal(
        duplicateExternalId.response.body.error.code,
        'duplicate_external_id',
    );
});

test('checkExternalIngestRateLimit isolates buckets by API key and returns retry info', async () => {
    const store = createInMemoryExternalIngestRateLimitStore();
    const authA = { userId: 'user_123', apiKeyId: 'key_a' };
    const authB = { userId: 'user_123', apiKeyId: 'key_b' };

    const first = await checkExternalIngestRateLimit({
        auth: authA,
        store,
        limit: 2,
        windowMs: 60_000,
        now,
    });
    const second = await checkExternalIngestRateLimit({
        auth: authA,
        store,
        limit: 2,
        windowMs: 60_000,
        now,
    });
    const limited = await checkExternalIngestRateLimit({
        auth: authA,
        store,
        limit: 2,
        windowMs: 60_000,
        now,
    });
    const otherKey = await checkExternalIngestRateLimit({
        auth: authB,
        store,
        limit: 2,
        windowMs: 60_000,
        now,
    });

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(limited.allowed, false);
    assert.equal(limited.retryAfterSeconds, 60);
    assert.equal(limited.response.status, 429);
    assert.equal(limited.response.body.error.code, 'rate_limited');
    assert.equal(limited.response.body.error.retryAfterSeconds, 60);
    assert.equal(
        limited.response.body.error.resetAt,
        '2026-07-05T12:01:00.000Z',
    );
    assert.equal(otherKey.allowed, true);
});

test('external ingest source helpers create integration audit context without storing secrets or file payloads', () => {
    const sourceContext = buildExternalIngestSourceContext({
        auth: {
            userId: 'user_123',
            apiKeyId: 'key_123',
            scopes: ['ingest:write'],
            keyName: 'ERP',
            keyPrefix: 'nn_test_abc',
        },
        sourceSystem: 'acme-erp',
        externalId: 'invoice-1',
        ingestEventId: 'ing_1',
        requestId: 'req_1',
    });
    const metadata = buildExternalIngestAuditSourceMetadata({
        apiKeyId: sourceContext.apiKeyId,
        sourceSystem: sourceContext.sourceSystem,
        externalId: sourceContext.externalId,
        ingestEventId: sourceContext.ingestEventId,
        requestId: sourceContext.requestId,
        idempotencyKey: 'idem-1',
    });
    const values = buildAuditEventValues({
        userId: 'user_123',
        actorUserId: sourceContext.actorUserId,
        actorType: sourceContext.actorType,
        action: 'create',
        resourceType: 'document',
        resourceId: 'doc_1',
        sourceMetadata: {
            ...metadata,
            authorization: 'Bearer nn_live_secret',
            uploadUrl: 'https://storage.example/signed',
            fileContents: 'raw-file-bytes',
            nested: {
                fileContent: 'base64-file',
                safe: 'visible',
            },
        },
        requestId: sourceContext.requestId,
    });

    assert.equal(sourceContext.actorType, 'integration');
    assert.equal(sourceContext.actorUserId, 'user_123');
    assert.equal(metadata.source, 'external_api');
    assert.equal(metadata.apiKeyId, 'key_123');
    assert.equal(metadata.sourceSystem, 'acme-erp');
    assert.equal(metadata.externalId, 'invoice-1');
    assert.equal(metadata.ingestEventId, 'ing_1');
    assert.equal(
        metadata.idempotencyKeyHash,
        hashExternalIngestIdempotencyKey('idem-1'),
    );
    assert.equal(values.actorType, 'integration');
    assert.equal(values.sourceMetadata.authorization, AUDIT_REDACTED_VALUE);
    assert.equal(values.sourceMetadata.uploadUrl, AUDIT_REDACTED_VALUE);
    assert.equal(values.sourceMetadata.fileContents, AUDIT_REDACTED_VALUE);
    assert.equal(
        values.sourceMetadata.nested.fileContent,
        AUDIT_REDACTED_VALUE,
    );
    assert.equal(values.sourceMetadata.nested.safe, 'visible');
    assert.equal(
        JSON.stringify(values.sourceMetadata).includes('nn_live'),
        false,
    );
    assert.equal(
        JSON.stringify(values.sourceMetadata).includes('raw-file-bytes'),
        false,
    );
});

test('external ingest retention policy documents the cleanup window', () => {
    assert.deepEqual(getExternalIngestRetentionPolicy(), {
        retentionDays: 30,
        cleanup:
            'Expired external ingest idempotency records may be deleted after the retention window; the DB store deletes expired records before reserving new requests.',
    });
});
