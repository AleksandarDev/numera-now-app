import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/db';
delete process.env.EXTERNAL_INGEST_IDEMPOTENCY_RETENTION_DAYS;
delete process.env.EXTERNAL_INGEST_RATE_LIMIT_MAX;
delete process.env.EXTERNAL_INGEST_RATE_LIMIT_WINDOW_MS;

const { createExternalIngestRoutes } = await import(
    '../app/api/[[...route]]/externalIngestRoutes.ts'
);

const now = new Date('2026-07-05T12:00:00.000Z');
const userId = 'user_123';
const authContext = {
    userId,
    apiKeyId: 'key_123',
    scopes: ['ingest:write'],
    keyName: 'ERP production',
    keyPrefix: 'nn_test_abc',
};

const createAuthMiddleware = () => async (ctx, next) => {
    const authorization = ctx.req.header('authorization');

    if (authorization === 'Bearer valid') {
        ctx.set('externalApiAuth', authContext);
        await next();
        return;
    }

    if (authorization === 'Bearer underscoped') {
        return ctx.json(
            {
                error: {
                    code: 'insufficient_scope',
                    message: 'API key does not have the required scope.',
                },
            },
            403,
        );
    }

    return ctx.json(
        {
            error: {
                code: authorization ? 'invalid_api_key' : 'missing_api_key',
                message: authorization
                    ? 'Invalid API key.'
                    : 'Missing API key.',
            },
        },
        401,
    );
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

const createPorts = () => {
    const calls = [];

    const ports = {
        validateDateNotInClosedPeriod: async () => null,
        getSettings: async () => ({ doubleEntryMode: false }),
        getAccounts: async () => [],
        findMatchingTransaction: async () => null,
        getTransaction: async () => null,
        createTransaction: async ({ values, sourceContext }) => {
            calls.push({ name: 'createTransaction', values, sourceContext });
            return {
                id: 'txn_created',
                date: values.date,
                amount: values.amount,
                payee: values.payee ?? null,
                notes: values.notes ?? null,
                accountId: values.accountId ?? null,
                creditAccountId: values.creditAccountId ?? null,
                debitAccountId: values.debitAccountId ?? null,
                status: values.status ?? 'draft',
                splitType: null,
            };
        },
        updateTransaction: async ({ transaction, values, sourceContext }) => {
            calls.push({
                name: 'updateTransaction',
                values,
                sourceContext,
            });
            return { ...transaction, ...values };
        },
        getDocumentTypes: async () => [
            { id: 'invoice_type', name: 'Invoice' },
            { id: 'receipt_type', name: 'Receipt' },
        ],
        getExistingDocumentKeys: async () => new Set(),
        createDocument: async ({
            attachment,
            documentTypeId,
            sourceContext,
        }) => {
            calls.push({
                name: 'createDocument',
                attachment,
                documentTypeId,
                sourceContext,
            });
            return {
                id: `doc_${calls.length}`,
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
                storagePath: attachment.storagePath,
                documentTypeId,
            };
        },
        createDocumentLink: async ({
            documentId,
            transactionId,
            sourceContext,
        }) => {
            calls.push({
                name: 'createDocumentLink',
                documentId,
                transactionId,
                sourceContext,
            });
        },
    };

    return { calls, ports };
};

const createTestApp = () => {
    const idempotency = createIdempotencyStore();
    const { calls, ports } = createPorts();
    const app = createExternalIngestRoutes({
        authMiddleware: createAuthMiddleware(),
        rateLimitMiddleware: async (_ctx, next) => next(),
        idempotencyStore: idempotency.store,
        ingestionPorts: ports,
        uploadUrlGenerator: ({ userId, fileName }) => ({
            storagePath: `users/${userId}/standalone/${fileName}`,
            uploadUrl: `https://storage.example/upload/${fileName}?sig=test`,
            expiresAt: new Date('2026-07-05T12:30:00.000Z'),
        }),
        now: () => now,
    });

    return { app, calls, idempotency };
};

const createInvoiceBody = (overrides = {}) => {
    const body = {
        externalId: 'erp-invoice-1',
        sourceSystem: 'acme-erp',
        document: {
            kind: 'invoice',
            number: '2026-1',
            issueDate: '2026-07-05',
            totalAmount: '125.40',
            paymentReference: 'HR00 2026-1',
        },
        counterparty: {
            name: 'Example Supplier',
        },
        transaction: {
            mode: 'createDraft',
        },
        matching: {
            strategy: 'none',
        },
        attachments: [
            {
                uploadId: `users/${userId}/standalone/invoice.pdf`,
                fileName: 'invoice.pdf',
                mimeType: 'application/pdf',
                fileSize: 1024,
                documentTypeId: 'invoice_type',
            },
        ],
    };

    return {
        ...body,
        ...overrides,
        document: {
            ...body.document,
            ...overrides.document,
        },
        counterparty: {
            ...body.counterparty,
            ...overrides.counterparty,
        },
        transaction: {
            ...body.transaction,
            ...overrides.transaction,
        },
        matching: {
            ...body.matching,
            ...overrides.matching,
        },
        attachments: overrides.attachments ?? body.attachments,
    };
};

const postJson = (app, path, body, headers = {}) =>
    app.request(path, {
        method: 'POST',
        headers: {
            authorization: 'Bearer valid',
            'content-type': 'application/json',
            'idempotency-key': 'idem-1',
            'x-request-id': 'req_1',
            ...headers,
        },
        body: JSON.stringify(body),
    });

test('POST /invoices ingests metadata and uploaded document references', async () => {
    const { app, calls } = createTestApp();
    const response = await postJson(app, '/invoices', createInvoiceBody());
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.idempotentReplay, false);
    assert.equal(body.data.ingestEventId, 'ing_1');
    assert.equal(body.data.outcome, 'created');
    assert.deepEqual(body.data.transaction, {
        id: 'txn_created',
        status: 'draft',
    });
    assert.equal(body.data.documents.length, 1);
    assert.equal(body.data.documents[0].id, 'doc_2');

    const transactionCall = calls.find(
        (call) => call.name === 'createTransaction',
    );
    assert.equal(transactionCall.values.amount, 125_400);
    assert.equal(
        transactionCall.values.date.toISOString(),
        '2026-07-05T00:00:00.000Z',
    );
    assert.equal(transactionCall.values.payee, 'Example Supplier');
    assert.equal(transactionCall.sourceContext.actorType, 'integration');
    assert.equal(transactionCall.sourceContext.actorUserId, userId);
    assert.equal(transactionCall.sourceContext.apiKeyId, 'key_123');
    assert.equal(transactionCall.sourceContext.sourceSystem, 'acme-erp');
    assert.equal(transactionCall.sourceContext.externalId, 'erp-invoice-1');
    assert.equal(transactionCall.sourceContext.ingestEventId, 'ing_1');
    assert.equal(transactionCall.sourceContext.requestId, 'req_1');
});

test('POST /receipts accepts receipt payloads', async () => {
    const { app } = createTestApp();
    const response = await postJson(
        app,
        '/receipts',
        createInvoiceBody({
            externalId: 'erp-receipt-1',
            document: {
                kind: 'receipt',
                number: 'R-1',
            },
            attachments: [],
        }),
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.transaction.id, 'txn_created');
    assert.equal(body.data.documents.length, 0);
});

test('POST /uploads returns an upload URL and uploadId for later ingestion', async () => {
    const { app } = createTestApp();
    const response = await postJson(
        app,
        '/uploads',
        {
            fileName: 'invoice.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
        },
        { 'idempotency-key': 'upload-1' },
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.uploadId, `users/${userId}/standalone/invoice.pdf`);
    assert.equal(
        body.data.uploadUrl,
        'https://storage.example/upload/invoice.pdf?sig=test',
    );
    assert.equal(body.data.expiresAt, '2026-07-05T12:30:00.000Z');
    assert.deepEqual(body.data.requiredHeaders, {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/pdf',
    });
});

test('external routes return documented auth failures', async () => {
    const { app } = createTestApp();
    const missingAuth = await postJson(app, '/invoices', createInvoiceBody(), {
        authorization: '',
    });
    const missingAuthBody = await missingAuth.json();
    const underscoped = await postJson(app, '/invoices', createInvoiceBody(), {
        authorization: 'Bearer underscoped',
    });
    const underscopedBody = await underscoped.json();

    assert.equal(missingAuth.status, 401);
    assert.equal(missingAuthBody.error.code, 'missing_api_key');
    assert.equal(underscoped.status, 403);
    assert.equal(underscopedBody.error.code, 'insufficient_scope');
});

test('external routes reject validation failures and unsupported file types', async () => {
    const { app } = createTestApp();
    const invalidPayload = await postJson(
        app,
        '/invoices',
        createInvoiceBody({ sourceSystem: undefined }),
    );
    const invalidPayloadBody = await invalidPayload.json();
    const unsupportedUpload = await postJson(
        app,
        '/uploads',
        {
            fileName: 'invoice.exe',
            mimeType: 'application/x-msdownload',
            fileSize: 1024,
        },
        { 'idempotency-key': 'upload-2' },
    );
    const unsupportedUploadBody = await unsupportedUpload.json();
    const oversizedUpload = await postJson(
        app,
        '/uploads',
        {
            fileName: 'invoice.pdf',
            mimeType: 'application/pdf',
            fileSize: 10 * 1024 * 1024 + 1,
        },
        { 'idempotency-key': 'upload-3' },
    );
    const oversizedUploadBody = await oversizedUpload.json();
    const missingIdempotencyKey = await postJson(
        app,
        '/invoices',
        createInvoiceBody({ externalId: 'erp-invoice-no-idem' }),
        { 'idempotency-key': '' },
    );
    const missingIdempotencyKeyBody = await missingIdempotencyKey.json();

    assert.equal(invalidPayload.status, 422);
    assert.equal(invalidPayloadBody.error.code, 'validation_failed');
    assert.equal(invalidPayloadBody.error.details[0].path, 'sourceSystem');
    assert.equal(unsupportedUpload.status, 415);
    assert.equal(unsupportedUploadBody.error.code, 'unsupported_media_type');
    assert.equal(oversizedUpload.status, 413);
    assert.equal(oversizedUploadBody.error.code, 'file_too_large');
    assert.equal(missingIdempotencyKey.status, 400);
    assert.equal(missingIdempotencyKeyBody.error.code, 'invalid_request');
});

test('external ingest idempotently replays safe retries and rejects conflicting retries', async () => {
    const { app, calls } = createTestApp();
    const requestBody = createInvoiceBody();
    const first = await postJson(app, '/invoices', requestBody, {
        'idempotency-key': 'idem-retry',
    });
    const firstBody = await first.json();
    const replay = await postJson(app, '/invoices', requestBody, {
        'idempotency-key': 'idem-retry',
    });
    const replayBody = await replay.json();
    const conflict = await postJson(
        app,
        '/invoices',
        createInvoiceBody({
            document: {
                totalAmount: '999.00',
            },
        }),
        { 'idempotency-key': 'idem-retry' },
    );
    const conflictBody = await conflict.json();

    assert.equal(first.status, 201);
    assert.equal(firstBody.data.idempotentReplay, false);
    assert.equal(replay.status, 201);
    assert.equal(replayBody.data.idempotentReplay, true);
    assert.equal(
        calls.filter((call) => call.name === 'createTransaction').length,
        1,
    );
    assert.equal(conflict.status, 409);
    assert.equal(conflictBody.error.code, 'idempotency_conflict');
});
