import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createJsonToolResult, type NumeraMcpContext } from './context.ts';

const deletedModeSchema = z.enum(['include', 'only']).optional();
const limitSchema = z.number().int().min(1).max(100).optional();
const offsetSchema = z.number().int().min(0).optional();

const pageSchema = {
    limit: limitSchema,
    offset: offsetSchema,
};

type ServiceResult = unknown[] | Record<string, unknown> | null;
type ServiceFn<
    Input extends Record<string, unknown> = Record<string, unknown>,
> = (input: Input) => Promise<ServiceResult>;

export type McpReadServices = {
    listTransactions: ServiceFn;
    getTransaction: ServiceFn;
    listCustomers: ServiceFn;
    getCustomer: ServiceFn;
    listCustomerIbans: ServiceFn;
    listAccounts: ServiceFn;
    getAccount: ServiceFn;
    listTags: ServiceFn;
    getTag: ServiceFn;
    listDocuments: ServiceFn;
    getDocument: ServiceFn;
    listAuditEvents: ServiceFn;
};

const createListResult = (entity: string, data: ServiceResult) =>
    createJsonToolResult({
        entity,
        data: data ?? [],
    });

const createItemResult = (entity: string, data: ServiceResult) =>
    createJsonToolResult({
        entity,
        data,
        found: Boolean(data),
    });

export const registerReadMcpTools = (
    server: McpServer,
    context: NumeraMcpContext,
    services: McpReadServices,
) => {
    server.registerTool(
        'numera_list_transactions',
        {
            title: 'List Transactions',
            description:
                'List transactions scoped to the authenticated Numera user.',
            inputSchema: z.object({
                from: z.string().optional(),
                to: z.string().optional(),
                accountId: z.string().optional(),
                payeeCustomerId: z.string().optional(),
                deleted: deletedModeSchema,
                ...pageSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'transactions',
                await services.listTransactions({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_get_transaction',
        {
            title: 'Get Transaction',
            description:
                'Get one transaction by id when it belongs to the authenticated Numera user.',
            inputSchema: z.object({
                id: z.string().min(1),
                deleted: deletedModeSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createItemResult(
                'transaction',
                await services.getTransaction({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_customers',
        {
            title: 'List Customers',
            description:
                'List customers scoped to the authenticated Numera user.',
            inputSchema: z.object({
                search: z.string().optional(),
                deleted: deletedModeSchema,
                ...pageSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'customers',
                await services.listCustomers({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_get_customer',
        {
            title: 'Get Customer',
            description:
                'Get one customer by id when it belongs to the authenticated Numera user.',
            inputSchema: z.object({
                id: z.string().min(1),
                deleted: deletedModeSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createItemResult(
                'customer',
                await services.getCustomer({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_customer_ibans',
        {
            title: 'List Customer IBANs',
            description:
                'List IBANs for a customer scoped to the authenticated Numera user.',
            inputSchema: z.object({
                customerId: z.string().min(1),
                deleted: deletedModeSchema,
                customerDeleted: deletedModeSchema,
                ...pageSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'customer_ibans',
                await services.listCustomerIbans({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_accounts',
        {
            title: 'List Accounts',
            description:
                'List accounts scoped to the authenticated Numera user.',
            inputSchema: z.object({
                search: z.string().optional(),
                accountId: z.string().optional(),
                showClosed: z.boolean().optional(),
                ...pageSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'accounts',
                await services.listAccounts({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_get_account',
        {
            title: 'Get Account',
            description:
                'Get one account by id when it belongs to the authenticated Numera user.',
            inputSchema: z.object({
                id: z.string().min(1),
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createItemResult(
                'account',
                await services.getAccount({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_tags',
        {
            title: 'List Tags',
            description: 'List tags scoped to the authenticated Numera user.',
            inputSchema: z.object(pageSchema),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'tags',
                await services.listTags({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_get_tag',
        {
            title: 'Get Tag',
            description:
                'Get one tag by id when it belongs to the authenticated Numera user.',
            inputSchema: z.object({
                id: z.string().min(1),
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createItemResult(
                'tag',
                await services.getTag({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_documents',
        {
            title: 'List Documents',
            description:
                'List documents scoped to the authenticated Numera user.',
            inputSchema: z.object({
                documentTypeId: z.string().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                unattached: z.boolean().optional(),
                deleted: deletedModeSchema,
                ...pageSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'documents',
                await services.listDocuments({
                    userId: context.userId,
                    includeDownloadUrl: false,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_get_document',
        {
            title: 'Get Document',
            description:
                'Get one document by id when it belongs to the authenticated Numera user.',
            inputSchema: z.object({
                id: z.string().min(1),
                deleted: deletedModeSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createItemResult(
                'document',
                await services.getDocument({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );

    server.registerTool(
        'numera_list_audit_events',
        {
            title: 'List Audit Events',
            description:
                'List audit events scoped to the authenticated Numera user.',
            inputSchema: z.object({
                resourceType: z.string().optional(),
                resourceId: z.string().optional(),
                actorUserId: z.string().optional(),
                actorType: z.enum(['user', 'system', 'integration']).optional(),
                action: z.string().optional(),
                from: z.string().optional(),
                to: z.string().optional(),
                source: z.string().optional(),
                limit: limitSchema,
                offset: offsetSchema,
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
            },
        },
        async (input) =>
            createListResult(
                'audit_events',
                await services.listAuditEvents({
                    userId: context.userId,
                    ...input,
                }),
            ),
    );
};
