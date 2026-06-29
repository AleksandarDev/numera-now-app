import {
    getAccount,
    getCustomer,
    getDocument,
    getTag,
    getTransaction,
    listAccounts,
    listAuditEvents,
    listCustomerIbans,
    listCustomers,
    listDocuments,
    listTags,
    listTransactions,
} from '@/lib/services/finance-entities';

import type { McpReadServices } from './read-tools.ts';

export const defaultMcpReadServices: McpReadServices = {
    listTransactions: (input) =>
        listTransactions(input as Parameters<typeof listTransactions>[0]),
    getTransaction: (input) =>
        getTransaction(input as Parameters<typeof getTransaction>[0]),
    listCustomers: (input) =>
        listCustomers(input as Parameters<typeof listCustomers>[0]),
    getCustomer: (input) =>
        getCustomer(input as Parameters<typeof getCustomer>[0]),
    listCustomerIbans: (input) =>
        listCustomerIbans(input as Parameters<typeof listCustomerIbans>[0]),
    listAccounts: (input) =>
        listAccounts(input as Parameters<typeof listAccounts>[0]),
    getAccount: (input) =>
        getAccount(input as Parameters<typeof getAccount>[0]),
    listTags: (input) => listTags(input as Parameters<typeof listTags>[0]),
    getTag: (input) => getTag(input as Parameters<typeof getTag>[0]),
    listDocuments: (input) =>
        listDocuments(input as Parameters<typeof listDocuments>[0]),
    getDocument: (input) =>
        getDocument(input as Parameters<typeof getDocument>[0]),
    listAuditEvents: (input) =>
        listAuditEvents(input as Parameters<typeof listAuditEvents>[0]),
};
