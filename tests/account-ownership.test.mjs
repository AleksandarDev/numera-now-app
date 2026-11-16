import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    getDistinctAccountIds,
    getMissingAccountIds,
} from '../lib/account-ownership.ts';

test('account references ignore empty values and deduplicate IDs', () => {
    assert.deepEqual(
        getDistinctAccountIds([
            'account_1',
            undefined,
            'account_1',
            null,
            '',
            'account_2',
        ]),
        ['account_1', 'account_2'],
    );
});

test('account ownership comparison reports every unresolved reference', () => {
    assert.deepEqual(
        getMissingAccountIds(
            ['owned_account', 'foreign_account', 'missing_account'],
            ['owned_account'],
        ),
        ['foreign_account', 'missing_account'],
    );
});
