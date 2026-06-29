import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createTransactionRestorePatch,
    createTransactionSoftDeletePatch,
    expandTransactionLifecycleTargetIds,
    TRANSACTION_SPLIT_LIFECYCLE_POLICY,
} from '../lib/transaction-lifecycle.ts';

test('transaction soft delete patch records user, time, and reason', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');
    const patch = createTransactionSoftDeletePatch({
        userId: 'user_1',
        reason: 'Duplicate import',
        now,
    });

    assert.deepEqual(patch, {
        deletedAt: now,
        deletedBy: 'user_1',
        deleteReason: 'Duplicate import',
        restoredAt: null,
        restoredBy: null,
        restoreReason: null,
    });
});

test('transaction restore patch clears delete fields and records restore metadata', () => {
    const now = new Date('2026-06-29T12:10:00.000Z');
    const patch = createTransactionRestorePatch({
        userId: 'user_1',
        reason: 'Deleted by mistake',
        now,
    });

    assert.deepEqual(patch, {
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        restoredAt: now,
        restoredBy: 'user_1',
        restoreReason: 'Deleted by mistake',
    });
});

test('bulk lifecycle targeting expands selected split parents to children', () => {
    const targetIds = expandTransactionLifecycleTargetIds(
        ['parent_1'],
        [
            { id: 'parent_1', splitGroupId: 'split_1' },
            { id: 'child_1', splitGroupId: 'split_1' },
            { id: 'child_2', splitGroupId: 'split_1' },
            { id: 'other_1', splitGroupId: 'split_2' },
        ],
    );

    assert.deepEqual(targetIds, ['parent_1', 'child_1', 'child_2']);
});

test('bulk lifecycle targeting expands selected split children to the group', () => {
    const targetIds = expandTransactionLifecycleTargetIds(
        ['child_1'],
        [
            { id: 'parent_1', splitGroupId: 'split_1' },
            { id: 'child_1', splitGroupId: 'split_1' },
            { id: 'child_2', splitGroupId: 'split_1' },
            { id: 'solo_1', splitGroupId: null },
        ],
    );

    assert.deepEqual(targetIds, ['parent_1', 'child_1', 'child_2']);
});

test('split lifecycle behavior is documented for users and auditors', () => {
    assert.match(TRANSACTION_SPLIT_LIFECYCLE_POLICY, /split group/);
});
