import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    AUDIT_REDACTED_VALUE,
    AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE,
    buildAuditEventValues,
    createAuditFieldDelta,
    redactAuditPayload,
    runAuditedMutation,
} from '../lib/audit-core.ts';
import {
    buildMutationAuditEvents,
    inferAuditAction,
    inferAuditResourceId,
    inferAuditResourceType,
} from '../lib/audit-route-core.ts';

test('redactAuditPayload redacts nested sensitive fields', () => {
    assert.deepEqual(
        redactAuditPayload({
            name: 'Stripe',
            stripeSecretKey: 'sk_live_secret',
            nested: {
                accessToken: 'access-token',
                refresh_token: 'refresh-token',
                safe: 'visible',
            },
        }),
        {
            name: 'Stripe',
            stripeSecretKey: AUDIT_REDACTED_VALUE,
            nested: {
                accessToken: AUDIT_REDACTED_VALUE,
                refresh_token: AUDIT_REDACTED_VALUE,
                safe: 'visible',
            },
        },
    );
});

test('createAuditFieldDelta returns only changed fields', () => {
    assert.deepEqual(
        createAuditFieldDelta(
            {
                name: 'Old name',
                secretKey: 'old-secret',
                unchanged: true,
            },
            {
                name: 'New name',
                secretKey: 'new-secret',
                unchanged: true,
            },
        ),
        {
            name: {
                before: 'Old name',
                after: 'New name',
            },
            secretKey: {
                before: AUDIT_REDACTED_VALUE,
                after: AUDIT_REDACTED_VALUE,
            },
        },
    );
});

test('buildAuditEventValues normalizes actor and source metadata', () => {
    const values = buildAuditEventValues({
        userId: 'user_1',
        actorType: 'system',
        action: 'sync',
        resourceType: 'transaction',
        resourceId: 'txn_1',
        sourceMetadata: {
            route: '/api/sync',
            webhookSecret: 'secret',
        },
    });

    assert.equal(values.userId, 'user_1');
    assert.equal(values.actorUserId, null);
    assert.equal(values.actorType, 'system');
    assert.equal(values.action, 'sync');
    assert.deepEqual(values.sourceMetadata, {
        route: '/api/sync',
        webhookSecret: AUDIT_REDACTED_VALUE,
    });
});

test('runAuditedMutation fails closed without a transaction method', async () => {
    await assert.rejects(
        () => runAuditedMutation({}, async () => 'unreachable'),
        new Error(AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE),
    );
});

test('runAuditedMutation delegates to transaction-capable databases', async () => {
    const calls = [];
    const result = await runAuditedMutation(
        {
            transaction: async (callback) => {
                calls.push('begin');
                const value = await callback({ value: 42 });
                calls.push('commit');
                return value;
            },
        },
        async (tx) => tx.value,
    );

    assert.equal(result, 42);
    assert.deepEqual(calls, ['begin', 'commit']);
});

test('runAuditedMutation normalizes driver transaction support errors', async () => {
    await assert.rejects(
        () =>
            runAuditedMutation(
                {
                    transaction: async () => {
                        throw new Error(
                            'No transactions support in neon-http driver',
                        );
                    },
                },
                async () => 'unreachable',
            ),
        new Error(AUDIT_TRANSACTION_UNSUPPORTED_MESSAGE),
    );
});

test('runAuditedMutation lets transaction runner roll back callback failures', async () => {
    const calls = [];

    await assert.rejects(
        () =>
            runAuditedMutation(
                {
                    transaction: async (callback) => {
                        calls.push('begin');
                        try {
                            return await callback({ value: 42 });
                        } catch (error) {
                            calls.push('rollback');
                            throw error;
                        }
                    },
                },
                async () => {
                    throw new Error('business write failed');
                },
            ),
        new Error('business write failed'),
    );

    assert.deepEqual(calls, ['begin', 'rollback']);
});

test('inferAuditAction maps common mutation routes', () => {
    assert.equal(inferAuditAction('POST', '/api/transactions'), 'create');
    assert.equal(
        inferAuditAction('POST', '/api/transactions/bulk-delete'),
        'delete',
    );
    assert.equal(inferAuditAction('PATCH', '/api/customers/cus_1'), 'update');
    assert.equal(inferAuditAction('DELETE', '/api/documents/doc_1'), 'delete');
    assert.equal(inferAuditAction('POST', '/api/documents/doc_1/link'), 'link');
    assert.equal(inferAuditAction('POST', '/api/stripe/sync'), 'sync');
});

test('buildMutationAuditEvents creates operation and record events', () => {
    const events = buildMutationAuditEvents({
        method: 'POST',
        path: '/api/accounts/bulk-create',
        status: 201,
        userId: 'user_1',
        requestId: 'req_1',
        responseJson: {
            data: [{ id: 'acc_1', name: 'Checking' }],
        },
    });

    assert.equal(events.length, 2);
    assert.equal(events[0]?.resourceId, 'operation:req_1');
    assert.equal(events[1]?.resourceId, 'acc_1');
    assert.deepEqual(events[1]?.after, { id: 'acc_1', name: 'Checking' });
});

test('audit route inference resolves resource type and path ids', () => {
    assert.equal(
        inferAuditResourceType('/api/document-types/dt_1'),
        'document_types',
    );
    assert.equal(
        inferAuditResourceId('/api/customers/cus_1', undefined, 'req_1'),
        'cus_1',
    );
});
