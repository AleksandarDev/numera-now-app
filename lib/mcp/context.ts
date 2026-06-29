import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export const MCP_SOURCE = 'mcp';

export type NumeraMcpContext = {
    userId: string;
    authInfo: AuthInfo;
    source: typeof MCP_SOURCE;
};

export type JsonToolResultData = Record<string, unknown>;

const toJsonSafeData = (data: JsonToolResultData): JsonToolResultData =>
    JSON.parse(JSON.stringify(data)) as JsonToolResultData;

export const createJsonToolResult = (data: JsonToolResultData) => {
    const jsonSafeData = toJsonSafeData(data);

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(jsonSafeData),
            },
        ],
        structuredContent: jsonSafeData,
    };
};
