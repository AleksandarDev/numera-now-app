import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { MCP_SOURCE } from '../lib/mcp/context.ts';
import {
    createUnauthorizedMcpResponse,
    handleMcpRequest,
} from '../lib/mcp/http.ts';
import { createNumeraMcpServer } from '../lib/mcp/server.ts';

const createTestContext = () => ({
    userId: 'user_test_123',
    source: MCP_SOURCE,
    authInfo: {
        token: 'test-token',
        clientId: 'user_test_123',
        scopes: ['numera:user'],
        extra: {
            userId: 'user_test_123',
        },
    },
});

const createMockReadServices = () => {
    const calls = [];
    const createService = (name, result) => async (input) => {
        calls.push({ name, input });
        return result;
    };

    return {
        calls,
        services: {
            listTransactions: createService('listTransactions', []),
            getTransaction: createService('getTransaction', null),
            listCustomers: createService('listCustomers', [
                { id: 'customer_1', name: 'ACME' },
            ]),
            getCustomer: createService('getCustomer', null),
            listCustomerIbans: createService('listCustomerIbans', []),
            listAccounts: createService('listAccounts', []),
            getAccount: createService('getAccount', null),
            listTags: createService('listTags', []),
            getTag: createService('getTag', null),
            listDocuments: createService('listDocuments', []),
            getDocument: createService('getDocument', null),
            listAuditEvents: createService('listAuditEvents', []),
        },
    };
};

const createMockMutationServices = () => {
    const calls = [];
    const createService = (name, result) => async (input) => {
        calls.push({ name, input });
        return result;
    };

    return {
        calls,
        services: {
            deleteTransaction: createService('deleteTransaction', {
                ok: true,
                data: [{ id: 'transaction_1', deletedAt: '2026-06-30' }],
            }),
            restoreTransaction: createService('restoreTransaction', {
                ok: true,
                data: [{ id: 'transaction_1', deletedAt: null }],
            }),
            purgeTransaction: createService('purgeTransaction', {
                ok: false,
                status: 400,
                error: 'Permanent purge requires confirm: true.',
            }),
            deleteCustomer: createService('deleteCustomer', {
                ok: true,
                data: { id: 'customer_1', isDeleted: true },
            }),
            restoreCustomer: createService('restoreCustomer', {
                ok: true,
                data: { id: 'customer_1', isDeleted: false },
            }),
            deleteDocument: createService('deleteDocument', {
                ok: true,
                data: { id: 'document_1', isDeleted: true },
            }),
            restoreDocument: createService('restoreDocument', {
                ok: true,
                data: { id: 'document_1', isDeleted: false },
            }),
            purgeDocument: createService('purgeDocument', {
                ok: true,
                data: { id: 'document_1' },
            }),
        },
    };
};

test('unauthorized MCP response is a JSON-RPC error response', async () => {
    const response = createUnauthorizedMcpResponse();

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
        jsonrpc: '2.0',
        id: null,
        error: {
            code: -32001,
            message: 'Unauthorized.',
        },
    });
});

test('MCP request handler rejects unauthenticated requests before transport handling', async () => {
    const response = await handleMcpRequest(
        new Request('https://app.test/api/mcp'),
        {
            authenticate: async () => null,
        },
    );

    assert.equal(response.status, 401);
});

test('base MCP server registers authenticated whoami tool', async () => {
    const read = createMockReadServices();
    const mutations = createMockMutationServices();
    const server = createNumeraMcpServer(createTestContext(), {
        readServices: read.services,
        mutationServices: mutations.services,
    });
    const client = new Client({
        name: 'numera-test-client',
        version: '0.1.0',
    });
    const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
        const tools = await client.listTools();
        assert.ok(
            tools.tools.some((tool) => tool.name === 'numera_whoami'),
            'expected numera_whoami to be listed',
        );
        assert.ok(
            tools.tools.some((tool) => tool.name === 'numera_list_customers'),
            'expected numera_list_customers to be listed',
        );
        assert.ok(
            tools.tools.some(
                (tool) => tool.name === 'numera_delete_transaction',
            ),
            'expected numera_delete_transaction to be listed',
        );

        const result = await client.callTool({
            name: 'numera_whoami',
            arguments: {},
        });

        assert.deepEqual(result.structuredContent, {
            userId: 'user_test_123',
            source: MCP_SOURCE,
        });

        const customersResult = await client.callTool({
            name: 'numera_list_customers',
            arguments: {
                search: 'ACME',
                limit: 5,
            },
        });

        assert.deepEqual(customersResult.structuredContent, {
            entity: 'customers',
            data: [{ id: 'customer_1', name: 'ACME' }],
        });
        assert.deepEqual(read.calls, [
            {
                name: 'listCustomers',
                input: {
                    userId: 'user_test_123',
                    search: 'ACME',
                    limit: 5,
                },
            },
        ]);

        const deleteResult = await client.callTool({
            name: 'numera_delete_transaction',
            arguments: {
                id: 'transaction_1',
                reason: 'Duplicate imported transaction',
            },
        });

        assert.deepEqual(deleteResult.structuredContent, {
            entity: 'transaction',
            ok: true,
            data: [{ id: 'transaction_1', deletedAt: '2026-06-30' }],
        });
        assert.deepEqual(mutations.calls[0], {
            name: 'deleteTransaction',
            input: {
                userId: 'user_test_123',
                id: 'transaction_1',
                reason: 'Duplicate imported transaction',
            },
        });

        const purgeResult = await client.callTool({
            name: 'numera_purge_transaction',
            arguments: {
                id: 'transaction_1',
                confirm: true,
            },
        });

        assert.equal(purgeResult.isError, true);
        assert.deepEqual(purgeResult.structuredContent, {
            entity: 'transaction',
            ok: false,
            status: 400,
            error: 'Permanent purge requires confirm: true.',
        });
    } finally {
        await client.close();
        await server.close();
    }
});
