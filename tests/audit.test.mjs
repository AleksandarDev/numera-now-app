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
