import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { handleMcpRequest } from '@/lib/mcp/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handleAuthenticatedMcpRequest = (request: Request) =>
    handleMcpRequest(request, {
        authenticate: authenticateMcpRequest,
    });

export const GET = handleAuthenticatedMcpRequest;
export const POST = handleAuthenticatedMcpRequest;
export const DELETE = handleAuthenticatedMcpRequest;
