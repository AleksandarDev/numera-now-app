import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    AUDITABILITY_RETENTION_POLICY,
    AUDITABILITY_VERIFICATION_MATRIX,
    auditabilityMigrationTags,
} from '../lib/audit-rollout.ts';

test('auditability migrations stay in dependency order', () => {
    assert.deepEqual(auditabilityMigrationTags(), [
        '0043_same_the_initiative',
        '0044_quick_spiral',
        '0045_misty_sauron',
        '0046_colorful_rumiko_fujikawa',
    ]);
});

test('retention policy covers audit events, soft-deleted rows, and blobs', () => {
    assert.match(AUDITABILITY_RETENTION_POLICY.auditEvents, /seven years/);
    assert.match(AUDITABILITY_RETENTION_POLICY.softDeletedRecords, /purge/);
    assert.match(AUDITABILITY_RETENTION_POLICY.documentBlobs, /blobs/);
    assert.match(AUDITABILITY_RETENTION_POLICY.preMigrationHistory, /default/);
});

test('verification matrix covers finance-critical rollout areas', () => {
    const areas = AUDITABILITY_VERIFICATION_MATRIX.map((entry) => entry.area);

    assert.deepEqual(areas, [
        'Reports',
        'Reconciliation',
        'Imports and sync',
        'Recovery',
        'Customer revert',
        'Authorization',
    ]);
});
