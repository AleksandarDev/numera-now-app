import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { defaultMcpReadServices } from '@/lib/mcp/default-services';
import { handleMcpRequest } from '@/lib/mcp/http';
import { createNumeraMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleAuthenticatedMcpRequest = (request: Request) =>
    handleMcpRequest(request, {
        authenticate: authenticateMcpRequest,
        createServer: (context) =>
            createNumeraMcpServer(context, {
                readServices: defaultMcpReadServices,
            }),
    });

export const GET = handleAuthenticatedMcpRequest;
export const POST = handleAuthenticatedMcpRequest;
export const DELETE = handleAuthenticatedMcpRequest;
