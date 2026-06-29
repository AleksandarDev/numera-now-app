import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
    createJsonErrorToolResult,
    createJsonToolResult,
    type NumeraMcpContext,
} from './context.ts';

type MutationResult =
    | {
          ok: true;
          data: unknown;
      }
    | {
          ok: false;
          status: number;
          error: string;
      };

type MutationService = (input: {
    userId: string;
    id: string;
    reason?: string | null;
    confirm?: boolean;
}) => Promise<MutationResult>;

export type McpMutationServices = {
    deleteTransaction: MutationService;
    restoreTransaction: MutationService;
    purgeTransaction: MutationService;
    deleteCustomer: MutationService;
    restoreCustomer: MutationService;
    deleteDocument: MutationService;
    restoreDocument: MutationService;
    purgeDocument: MutationService;
};

const lifecycleInputSchema = z.object({
    id: z.string().min(1),
    reason: z.string().max(500).optional(),
});

const purgeInputSchema = lifecycleInputSchema.extend({
    confirm: z.literal(true),
});

const createMutationToolResult = (entity: string, result: MutationResult) => {
    if (!result.ok) {
        return createJsonErrorToolResult({
            entity,
            ok: false,
            status: result.status,
            error: result.error,
        });
    }

    return createJsonToolResult({
        entity,
        ok: true,
        data: result.data,
    });
};

const registerLifecycleTool = ({
    server,
    context,
    name,
    title,
    description,
    entity,
    service,
}: {
    server: McpServer;
    context: NumeraMcpContext;
    name: string;
    title: string;
    description: string;
    entity: string;
    service: MutationService;
}) => {
    server.registerTool(
        name,
        {
            title,
            description,
            inputSchema: lifecycleInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
        },
        async (input) =>
            createMutationToolResult(
                entity,
                await service({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );
};

const registerPurgeTool = ({
    server,
    context,
    name,
    title,
    description,
    entity,
    service,
}: {
    server: McpServer;
    context: NumeraMcpContext;
    name: string;
    title: string;
    description: string;
    entity: string;
    service: MutationService;
}) => {
    server.registerTool(
        name,
        {
            title,
            description,
            inputSchema: purgeInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
        },
        async (input) =>
            createMutationToolResult(
                entity,
                await service({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );
};

export const registerMutationMcpTools = (
    server: McpServer,
    context: NumeraMcpContext,
    services: McpMutationServices,
) => {
    registerLifecycleTool({
        server,
        context,
        name: 'numera_delete_transaction',
        title: 'Delete Transaction',
        description:
            'Soft-delete a transaction for the authenticated Numera user. Split transaction groups are handled by the app lifecycle policy.',
        entity: 'transaction',
        service: services.deleteTransaction,
    });
    registerLifecycleTool({
        server,
        context,
        name: 'numera_restore_transaction',
        title: 'Restore Transaction',
        description:
            'Restore a previously soft-deleted transaction for the authenticated Numera user.',
        entity: 'transaction',
        service: services.restoreTransaction,
    });
    registerPurgeTool({
        server,
        context,
        name: 'numera_purge_transaction',
        title: 'Purge Transaction',
        description:
            'Permanently purge a previously soft-deleted transaction. Requires confirm: true.',
        entity: 'transaction',
        service: services.purgeTransaction,
    });
    registerLifecycleTool({
        server,
        context,
        name: 'numera_delete_customer',
        title: 'Delete Customer',
        description:
            'Soft-delete a customer for the authenticated Numera user.',
        entity: 'customer',
        service: services.deleteCustomer,
    });
    registerLifecycleTool({
        server,
        context,
        name: 'numera_restore_customer',
        title: 'Restore Customer',
        description:
            'Restore a previously soft-deleted customer for the authenticated Numera user.',
        entity: 'customer',
        service: services.restoreCustomer,
    });
    registerLifecycleTool({
        server,
        context,
        name: 'numera_delete_document',
        title: 'Delete Document',
        description:
            'Soft-delete a document for the authenticated Numera user while retaining the backing blob.',
        entity: 'document',
        service: services.deleteDocument,
    });
    registerLifecycleTool({
        server,
        context,
        name: 'numera_restore_document',
        title: 'Restore Document',
        description:
            'Restore a previously soft-deleted document for the authenticated Numera user.',
        entity: 'document',
        service: services.restoreDocument,
    });
    registerPurgeTool({
        server,
        context,
        name: 'numera_purge_document',
        title: 'Purge Document',
        description:
            'Permanently purge a previously soft-deleted document and its backing blob. Requires confirm: true.',
        entity: 'document',
        service: services.purgeDocument,
    });
};
