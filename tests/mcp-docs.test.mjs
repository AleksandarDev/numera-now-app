import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readDocs = () => readFile('docs/mcp-server.md', 'utf8');

test('MCP docs cover endpoint, auth, and core tool families', async () => {
    const docs = await readDocs();

    assert.match(docs, /\/api\/mcp/);
    assert.match(docs, /Clerk/);
    assert.match(docs, /numera_list_transactions/);
    assert.match(docs, /numera_list_customers/);
    assert.match(docs, /numera_list_documents/);
    assert.match(docs, /numera_delete_transaction/);
    assert.match(docs, /numera_restore_document/);
});

test('MCP docs pin shared-service and destructive-operation guardrails', async () => {
    const docs = await readDocs();

    assert.match(docs, /shared service/);
    assert.match(docs, /Do not query Drizzle directly from a tool handler/);
    assert.match(docs, /confirm: true/);
    assert.match(docs, /audit events/);
});
