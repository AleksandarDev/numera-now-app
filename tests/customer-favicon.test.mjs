import assert from 'node:assert/strict';
import test from 'node:test';

import {
    fetchCustomerAvatarImage,
    normalizeCustomerWebsite,
} from '../lib/customer-favicon.ts';

test('normalizes public customer websites', () => {
    assert.equal(
        normalizeCustomerWebsite('example.com/company#team'),
        'https://example.com/company',
    );
    assert.equal(
        normalizeCustomerWebsite('http://example.com'),
        'http://example.com/',
    );
});

test('rejects private customer websites before fetching', async () => {
    const originalFetch = globalThis.fetch;
    let didFetch = false;

    globalThis.fetch = async () => {
        didFetch = true;
        return new Response(null, { status: 404 });
    };

    try {
        assert.equal(normalizeCustomerWebsite('localhost:3000'), null);
        assert.equal(await fetchCustomerAvatarImage('http://127.0.0.1'), null);
        assert.equal(didFetch, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('downloads favicon as a stored data url', async () => {
    const originalFetch = globalThis.fetch;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" />';
    const calls = [];

    globalThis.fetch = async (input) => {
        const url = String(input);
        calls.push(url);

        if (url === 'https://example.com/') {
            return new Response(
                '<html><head><link rel="icon" type="image/svg+xml" href="/brand.svg"></head></html>',
                {
                    headers: {
                        'content-type': 'text/html',
                    },
                },
            );
        }

        if (url === 'https://example.com/brand.svg') {
            return new Response(svg, {
                headers: {
                    'content-type': 'image/svg+xml',
                },
            });
        }

        return new Response(null, { status: 404 });
    };

    try {
        assert.equal(
            await fetchCustomerAvatarImage('example.com'),
            `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        );
        assert.deepEqual(calls, [
            'https://example.com/',
            'https://example.com/brand.svg',
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
