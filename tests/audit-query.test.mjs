import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    DEFAULT_AUDIT_EVENT_LIMIT,
    MAX_AUDIT_EVENT_LIMIT,
    normalizeAuditEventDate,
    normalizeAuditEventLimit,
    normalizeAuditEventSource,
} from '../lib/audit-query.ts';

test('normalizeAuditEventLimit defaults invalid limits', () => {
    assert.equal(normalizeAuditEventLimit(), DEFAULT_AUDIT_EVENT_LIMIT);
    assert.equal(normalizeAuditEventLimit(0), DEFAULT_AUDIT_EVENT_LIMIT);
    assert.equal(
        normalizeAuditEventLimit(Number.NaN),
        DEFAULT_AUDIT_EVENT_LIMIT,
    );
});

test('normalizeAuditEventLimit clamps and floors valid limits', () => {
    assert.equal(normalizeAuditEventLimit(25.9), 25);
    assert.equal(
        normalizeAuditEventLimit(MAX_AUDIT_EVENT_LIMIT + 50),
        MAX_AUDIT_EVENT_LIMIT,
    );
});

test('normalizeAuditEventSource trims empty source filters', () => {
    assert.equal(
        normalizeAuditEventSource('  customers_update  '),
        'customers_update',
    );
    assert.equal(normalizeAuditEventSource('   '), undefined);
});

test('normalizeAuditEventDate returns undefined for invalid dates', () => {
    assert.equal(normalizeAuditEventDate('not-a-date'), undefined);
    assert.equal(
        normalizeAuditEventDate('2026-06-29T12:00:00.000Z')?.toISOString(),
        '2026-06-29T12:00:00.000Z',
    );
});
