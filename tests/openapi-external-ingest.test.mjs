import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const specUrl = new URL(
    '../docs/openapi/external-ingest.json',
    import.meta.url,
);
const spec = JSON.parse(readFileSync(specUrl, 'utf8'));

const collectRefs = (value, refs = new Set()) => {
    if (Array.isArray(value)) {
        for (const entry of value) {
            collectRefs(entry, refs);
        }
        return refs;
    }

    if (!value || typeof value !== 'object') {
        return refs;
    }

    if (typeof value.$ref === 'string') {
        refs.add(value.$ref);
    }

    for (const entry of Object.values(value)) {
        collectRefs(entry, refs);
    }

    return refs;
};

const resolveJsonPointer = (document, pointer) => {
    if (!pointer.startsWith('#/')) {
        return undefined;
    }

    return pointer
        .slice(2)
        .split('/')
        .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
        .reduce((current, part) => current?.[part], document);
};

test('external ingest OpenAPI spec is parseable and describes implemented routes', () => {
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(
        spec.info.title,
        'Numera External Receipt and Invoice Ingestion API',
    );
    assert.ok(spec.components.securitySchemes.BearerApiKey);
    assert.ok(spec.paths['/uploads'].post);
    assert.ok(spec.paths['/invoices'].post);
    assert.ok(spec.paths['/receipts'].post);
    assert.equal(spec.paths['/ingest-events/{id}'], undefined);

    const invoicePost = spec.paths['/invoices'].post;
    assert.ok(
        invoicePost.parameters.some(
            (parameter) =>
                parameter.$ref === '#/components/parameters/IdempotencyKey',
        ),
    );
    assert.ok(invoicePost.responses['201']);
    assert.ok(invoicePost.responses['200']);
    assert.ok(invoicePost.responses['409']);

    const uploadRequest =
        spec.components.schemas.UploadRequest.properties.mimeType;
    assert.deepEqual(uploadRequest.enum, [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/xml',
        'text/xml',
    ]);
});

test('external ingest OpenAPI local references resolve', () => {
    for (const ref of collectRefs(spec)) {
        assert.ok(ref.startsWith('#/'), `Expected local ref, received ${ref}`);
        assert.notEqual(resolveJsonPointer(spec, ref), undefined, ref);
    }
});
