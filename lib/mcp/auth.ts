import { clerkClient } from '@clerk/nextjs/server';

import { MCP_SOURCE, type NumeraMcpContext } from './context.ts';

const MCP_USER_SCOPE = 'numera:user';

const getAuthUserId = (authObject: unknown) => {
    if (
        authObject &&
        typeof authObject === 'object' &&
        'userId' in authObject &&
        typeof authObject.userId === 'string'
    ) {
        return authObject.userId;
    }

    return null;
};

export const authenticateMcpRequest = async (
    request: Request,
): Promise<NumeraMcpContext | null> => {
    const client = await clerkClient();
    const requestState = await client.authenticateRequest(request, {
        acceptsToken: 'any',
    });

    if (!requestState.isAuthenticated) {
        return null;
    }

    const authObject = requestState.toAuth();
    const userId = getAuthUserId(authObject);

    if (!userId) {
        return null;
    }

    return {
        userId,
        source: MCP_SOURCE,
        authInfo: {
            token: requestState.token,
            clientId: userId,
            scopes: [MCP_USER_SCOPE],
            extra: {
                userId,
                clerkTokenType: requestState.tokenType,
            },
        },
    };
};
