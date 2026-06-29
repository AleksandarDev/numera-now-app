import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createDocumentRestorePatch,
    createDocumentSoftDeletePatch,
    DOCUMENT_SOFT_DELETE_BLOB_POLICY,
} from '../lib/document-lifecycle.ts';

test('document soft delete patch records actor, time, and reason while retaining blob policy', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');
    const patch = createDocumentSoftDeletePatch({
        userId: 'user_1',
        reason: 'Wrong file',
        now,
    });

    assert.deepEqual(patch, {
        isDeleted: true,
        deletedAt: now,
        deletedBy: 'user_1',
        deleteReason: 'Wrong file',
        restoredAt: null,
        restoredBy: null,
        restoreReason: null,
    });
    assert.match(DOCUMENT_SOFT_DELETE_BLOB_POLICY, /retain/);
});

test('document restore patch clears delete fields and records restore metadata', () => {
    const now = new Date('2026-06-29T12:10:00.000Z');
    const patch = createDocumentRestorePatch({
        userId: 'user_1',
        reason: 'Needed for reconciliation',
        now,
    });

    assert.deepEqual(patch, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        restoredAt: now,
        restoredBy: 'user_1',
        restoreReason: 'Needed for reconciliation',
    });
});
