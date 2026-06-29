import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import type { NumeraMcpContext } from './context.ts';
import { createNumeraMcpServer } from './server.ts';

export type McpAuthenticator = (
    request: Request,
) => Promise<NumeraMcpContext | null>;

export type HandleMcpRequestOptions = {
    authenticate: McpAuthenticator;
    createServer?: typeof createNumeraMcpServer;
};

export const createUnauthorizedMcpResponse = () =>
    Response.json(
        {
            jsonrpc: '2.0',
            id: null,
            error: {
                code: -32001,
                message: 'Unauthorized.',
            },
        },
        { status: 401 },
    );

export const handleMcpRequest = async (
    request: Request,
    options: HandleMcpRequestOptions,
) => {
    const context = await options.authenticate(request);

    if (!context) {
        return createUnauthorizedMcpResponse();
    }

    const server = (options.createServer ?? createNumeraMcpServer)(context);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    await server.connect(transport);

    try {
        return await transport.handleRequest(request, {
            authInfo: context.authInfo,
        });
    } finally {
        await server.close();
    }
};
