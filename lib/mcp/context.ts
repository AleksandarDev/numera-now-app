import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export const MCP_SOURCE = 'mcp';

export type NumeraMcpContext = {
    userId: string;
    authInfo: AuthInfo;
    source: typeof MCP_SOURCE;
};

export type JsonToolResultData = Record<string, unknown>;

export const createJsonToolResult = (data: JsonToolResultData) => ({
    content: [
        {
            type: 'text' as const,
            text: JSON.stringify(data),
        },
    ],
    structuredContent: data,
});
