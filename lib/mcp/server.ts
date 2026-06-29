import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    createJsonToolResult,
    MCP_SOURCE,
    type NumeraMcpContext,
} from './context.ts';

export const NUMERA_MCP_SERVER_NAME = 'numera-now';
export const NUMERA_MCP_SERVER_VERSION = '0.1.0';

export const registerBaseMcpTools = (
    server: McpServer,
    context: NumeraMcpContext,
) => {
    server.registerTool(
        'numera_whoami',
        {
            title: 'Current Numera User',
            description:
                'Return the authenticated Numera user scope for this MCP session.',
            inputSchema: z.object({}),
            outputSchema: z.object({
                userId: z.string(),
                source: z.literal(MCP_SOURCE),
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async () =>
            createJsonToolResult({
                userId: context.userId,
                source: context.source,
            }),
    );
};

export const createNumeraMcpServer = (context: NumeraMcpContext) => {
    const server = new McpServer({
        name: NUMERA_MCP_SERVER_NAME,
        version: NUMERA_MCP_SERVER_VERSION,
    });

    registerBaseMcpTools(server, context);

    return server;
};
