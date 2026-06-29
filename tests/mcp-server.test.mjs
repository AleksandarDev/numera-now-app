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
    const { calls, services } = createMockReadServices();
    const server = createNumeraMcpServer(createTestContext(), {
        readServices: services,
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
        assert.deepEqual(calls, [
            {
                name: 'listCustomers',
                input: {
                    userId: 'user_test_123',
                    search: 'ACME',
                    limit: 5,
                },
            },
        ]);
    } finally {
        await client.close();
        await server.close();
    }
});
