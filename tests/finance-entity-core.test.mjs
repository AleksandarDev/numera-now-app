import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildTransactionDocumentCounts,
    DEFAULT_ENTITY_LIMIT,
    escapeLikePattern,
    MAX_ENTITY_LIMIT,
    normalizeDeletedMode,
    normalizeEntityDate,
    normalizeEntityLimit,
    normalizeEntityOffset,
    normalizeIban,
    splitSearchKeywords,
} from '../lib/services/finance-entity-core.ts';

test('normalizeEntityLimit defaults invalid values and clamps valid values', () => {
    assert.equal(normalizeEntityLimit(), DEFAULT_ENTITY_LIMIT);
    assert.equal(normalizeEntityLimit(0), DEFAULT_ENTITY_LIMIT);
    assert.equal(normalizeEntityLimit(Number.NaN), DEFAULT_ENTITY_LIMIT);
    assert.equal(normalizeEntityLimit(25.9), 25);
    assert.equal(normalizeEntityLimit(MAX_ENTITY_LIMIT + 1), MAX_ENTITY_LIMIT);
});

test('normalizeEntityLimit accepts per-call default and max values', () => {
    assert.equal(normalizeEntityLimit(undefined, { defaultLimit: 10 }), 10);
    assert.equal(normalizeEntityLimit(500, { maxLimit: 250 }), 250);
});

test('normalizeEntityOffset floors positive values and defaults invalid values', () => {
    assert.equal(normalizeEntityOffset(), 0);
    assert.equal(normalizeEntityOffset(-1), 0);
    assert.equal(normalizeEntityOffset(Number.NaN), 0);
    assert.equal(normalizeEntityOffset(12.9), 12);
});

test('normalizeDeletedMode only accepts explicit deleted modes', () => {
    assert.equal(normalizeDeletedMode('include'), 'include');
    assert.equal(normalizeDeletedMode('only'), 'only');
    assert.equal(normalizeDeletedMode('deleted'), undefined);
    assert.equal(normalizeDeletedMode(), undefined);
});

test('search helpers preserve quoted terms and escape LIKE patterns', () => {
    assert.deepEqual(splitSearchKeywords('alpha "beta gamma"'), [
        'alpha',
        'beta gamma',
    ]);
    assert.equal(escapeLikePattern('ACME_100%'), 'ACME\\_100\\%');
});

test('entity normalization helpers handle dates and IBANs', () => {
    assert.equal(normalizeEntityDate('not-a-date'), undefined);
    assert.equal(
        normalizeEntityDate('2026-06-30T12:00:00.000Z')?.toISOString(),
        '2026-06-30T12:00:00.000Z',
    );
    assert.equal(normalizeIban('hr12 3456'), 'HR123456');
});

test('document counts apply split group documents to every group member', () => {
    const counts = buildTransactionDocumentCounts(
        [
            { id: 'parent_1', splitGroupId: 'split_1' },
            { id: 'child_1', splitGroupId: 'split_1' },
            { id: 'child_2', splitGroupId: 'split_1' },
            { id: 'solo_1', splitGroupId: null },
        ],
        [
            {
                documentId: 'document_1',
                transactionId: 'parent_1',
                documentTypeId: 'invoice',
            },
            {
                documentId: 'document_2',
                transactionId: 'child_1',
                documentTypeId: 'receipt',
            },
            {
                documentId: 'document_3',
                transactionId: 'solo_1',
                documentTypeId: 'receipt',
            },
        ],
        ['invoice', 'receipt'],
    );

    assert.deepEqual(counts.get('parent_1'), {
        total: 2,
        requiredTypes: ['invoice', 'receipt'],
    });
    assert.deepEqual(counts.get('child_1'), {
        total: 2,
        requiredTypes: ['invoice', 'receipt'],
    });
    assert.deepEqual(counts.get('child_2'), {
        total: 2,
        requiredTypes: ['invoice', 'receipt'],
    });
    assert.deepEqual(counts.get('solo_1'), {
        total: 1,
        requiredTypes: ['receipt'],
    });
});

test('document counts dedupe one document linked to multiple split members', () => {
    const counts = buildTransactionDocumentCounts(
        [
            { id: 'parent_1', splitGroupId: 'split_1' },
            { id: 'child_1', splitGroupId: 'split_1' },
            { id: 'child_2', splitGroupId: 'split_1' },
        ],
        [
            {
                documentId: 'document_1',
                transactionId: 'child_1',
                documentTypeId: 'receipt',
            },
            {
                documentId: 'document_1',
                transactionId: 'child_2',
                documentTypeId: 'receipt',
            },
        ],
        ['receipt'],
    );

    assert.deepEqual(counts.get('parent_1'), {
        total: 1,
        requiredTypes: ['receipt'],
    });
    assert.deepEqual(counts.get('child_1'), {
        total: 1,
        requiredTypes: ['receipt'],
    });
    assert.deepEqual(counts.get('child_2'), {
        total: 1,
        requiredTypes: ['receipt'],
    });
});
