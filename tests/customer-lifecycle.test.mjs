import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createCustomerIbanRestorePatch,
    createCustomerIbanSoftDeletePatch,
    createCustomerProfileRevertPatch,
    createCustomerRestorePatch,
    createCustomerSoftDeletePatch,
    getCustomerIbanRevertConflicts,
    getCustomerLifecycleRevertConflicts,
    getCustomerProfileRevertConflicts,
} from '../lib/customer-lifecycle.ts';

test('customer soft delete patch records user, time, and reason', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');
    const patch = createCustomerSoftDeletePatch({
        userId: 'user_1',
        reason: 'Duplicate customer',
        now,
    });

    assert.deepEqual(patch, {
        isDeleted: true,
        deletedAt: now,
        deletedBy: 'user_1',
        deleteReason: 'Duplicate customer',
        restoredAt: null,
        restoredBy: null,
        restoreReason: null,
    });
});

test('customer restore patch clears delete fields and records restore metadata', () => {
    const now = new Date('2026-06-29T12:10:00.000Z');
    const patch = createCustomerRestorePatch({
        userId: 'user_1',
        reason: 'Needed for transaction history',
        now,
    });

    assert.deepEqual(patch, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        restoredAt: now,
        restoredBy: 'user_1',
        restoreReason: 'Needed for transaction history',
    });
});

test('customer profile revert patch is limited to editable customer fields', () => {
    const patch = createCustomerProfileRevertPatch({
        id: 'cus_1',
        name: 'Before',
        friendlyName: null,
        website: 'https://example.com/',
        avatarImage: 'data:image/svg+xml;base64,PHN2Zy8+',
        vatNumber: 'HR123',
        address: 'Old address',
        contactEmail: 'old@example.com',
        contactTelephone: '+3851',
        country: 'HR',
        isComplete: true,
        isOwnFirm: false,
        userId: 'user_1',
        deletedAt: '2026-06-29T12:00:00.000Z',
    });

    assert.deepEqual(patch, {
        name: 'Before',
        friendlyName: null,
        website: 'https://example.com/',
        avatarImage: 'data:image/svg+xml;base64,PHN2Zy8+',
        vatNumber: 'HR123',
        address: 'Old address',
        contactEmail: 'old@example.com',
        contactTelephone: '+3851',
        country: 'HR',
        isComplete: true,
        isOwnFirm: false,
    });
});

test('customer profile revert detects conflicting current changes', () => {
    const conflicts = getCustomerProfileRevertConflicts({
        current: {
            name: 'Changed again',
            vatNumber: 'HR123',
            isOwnFirm: true,
        },
        eventAfter: {
            name: 'After',
            vatNumber: 'HR123',
            isOwnFirm: true,
        },
    });

    assert.deepEqual(conflicts, ['name']);
});

test('customer lifecycle revert detects later delete changes', () => {
    const conflicts = getCustomerLifecycleRevertConflicts({
        current: {
            name: 'Customer',
            isDeleted: true,
            deletedAt: '2026-06-29T12:10:00.000Z',
            deletedBy: 'user_1',
            deleteReason: 'Deleted again',
        },
        eventAfter: {
            name: 'Customer',
            isDeleted: true,
            deletedAt: '2026-06-29T12:00:00.000Z',
            deletedBy: 'user_1',
            deleteReason: 'Original delete',
        },
    });

    assert.deepEqual(conflicts, ['deletedAt', 'deleteReason']);
});

test('customer IBAN lifecycle patches support delete and restore', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');

    assert.deepEqual(
        createCustomerIbanSoftDeletePatch({
            userId: 'user_1',
            reason: 'Closed account',
            now,
        }),
        {
            isDeleted: true,
            deletedAt: now,
            deletedBy: 'user_1',
            deleteReason: 'Closed account',
            restoredAt: null,
            restoredBy: null,
            restoreReason: null,
        },
    );

    assert.deepEqual(
        createCustomerIbanRestorePatch({
            userId: 'user_1',
            reason: 'Account active again',
            now,
        }),
        {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            restoredAt: now,
            restoredBy: 'user_1',
            restoreReason: 'Account active again',
        },
    );
});

test('customer IBAN revert detects conflicts before restore or delete', () => {
    const conflicts = getCustomerIbanRevertConflicts({
        current: {
            iban: 'HR1210010051863000160',
            bankName: 'Changed Bank',
            isDeleted: true,
        },
        eventAfter: {
            iban: 'HR1210010051863000160',
            bankName: 'Original Bank',
            isDeleted: true,
        },
    });

    assert.deepEqual(conflicts, ['bankName']);
});
