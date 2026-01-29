'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { InferResponseType } from 'hono';
import { ArrowUpDown } from 'lucide-react';
import type { client } from '@/lib/hono';
import { AccountColumn } from './account-column';
import { Actions } from './actions';
import { CustomerColumn } from './customer-column';
import { DocumentsColumn } from './documents-column';
import { SplitAccountsColumn } from './split-accounts-column';
import { StatusColumn } from './status-column';
import { TagsColumn } from './tags-column';
import { validateTransaction } from './validation';

type TransactionStatus = 'draft' | 'pending' | 'completed' | 'reconciled';

type TransactionTag = {
    id: string;
    name: string;
    color?: string | null;
};

type SplitAccountSummary = {
    id: string;
    name: string;
    code?: string | null;
};

type SplitSummary = {
    status: TransactionStatus;
    tags: TransactionTag[];
    documentCount: number;
    hasAllRequiredDocuments: boolean;
    requiredDocumentTypes: number;
    attachedRequiredTypes: number;
    minRequiredDocuments: number;
    totalAmount: number;
    creditAccounts: SplitAccountSummary[];
    debitAccounts: SplitAccountSummary[];
    singleAccounts: SplitAccountSummary[];
    customers: string[];
};

type SplitMeta = {
    role: 'parent' | 'child';
    childIndex?: number;
    childCount?: number;
    isLastChild?: boolean;
};

export type ResponseType = InferResponseType<
    typeof client.api.transactions.$get,
    200
>['data'][0] & {
    splitSummary?: SplitSummary;
    splitMeta?: SplitMeta;
};

// Separate select column for conditional rendering
export const selectColumn: ColumnDef<ResponseType> = {
    id: 'select',
    header: ({ table }) => (
        <Checkbox
            checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
        />
    ),
    cell: ({ row }) => (
        <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
        />
    ),
    enableSorting: false,
    enableHiding: false,
};

const SplitFlowIndicator = ({ meta }: { meta?: SplitMeta }) => {
    if (!meta) return null;

    if (meta.role === 'parent') {
        if (!meta.childCount) return null;
        return (
            <div
                className="relative h-8 w-3"
                aria-label="Split parent transaction"
                role="img"
            >
                <span
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400"
                    aria-hidden="true"
                />
                <span
                    className="absolute left-1/2 top-1/2 bottom-0 w-px bg-slate-300"
                    aria-hidden="true"
                />
            </div>
        );
    }

    if (meta.role === 'child') {
        const isLastChild = meta.isLastChild ?? false;
        return (
            <div
                className="relative h-8 w-3"
                aria-label={`Split child transaction ${meta.childIndex !== undefined ? meta.childIndex + 1 : ''} of ${meta.childCount ?? ''}`}
                role="img"
            >
                <span
                    className={`absolute left-1/2 top-0 w-px bg-slate-300 ${
                        isLastChild ? 'bottom-1/2' : 'bottom-0'
                    }`}
                    aria-hidden="true"
                />
                <span
                    className="absolute left-1/2 top-1/2 w-2 border-t border-slate-300"
                    aria-hidden="true"
                />
                <span
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400"
                    aria-hidden="true"
                />
            </div>
        );
    }

    return null;
};

export const columns: ColumnDef<ResponseType>[] = [
    {
        id: 'flow',
        header: () => <span className="inline-block w-3" aria-hidden="true" />,
        enableSorting: false,
        cell: ({ row }) => <SplitFlowIndicator meta={row.original.splitMeta} />,
    },
    {
        accessorKey: 'status',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isParent = row.original.splitType === 'parent';
            const splitSummary = row.original.splitSummary;
            return (
                <StatusColumn
                    transactionId={row.original.id}
                    status={
                        splitSummary?.status ?? row.original.status ?? 'pending'
                    }
                    readOnly={isParent}
                    transaction={{
                        date: row.original.date,
                        amount: row.original.amount,
                        payeeCustomerId: row.original.payeeCustomerId,
                        payee: row.original.payee,
                        notes: row.original.notes,
                        accountId: row.original.accountId,
                        creditAccountId: row.original.creditAccountId,
                        debitAccountId: row.original.debitAccountId,
                        splitGroupId: row.original.splitGroupId,
                        splitType: row.original.splitType,
                    }}
                    hasAllRequiredDocuments={
                        splitSummary?.hasAllRequiredDocuments ??
                        row.original.hasAllRequiredDocuments ??
                        true
                    }
                    requiredDocumentTypes={
                        splitSummary?.requiredDocumentTypes ??
                        row.original.requiredDocumentTypes ??
                        0
                    }
                    attachedRequiredTypes={
                        splitSummary?.attachedRequiredTypes ??
                        row.original.attachedRequiredTypes ??
                        0
                    }
                    minRequiredDocuments={
                        splitSummary?.minRequiredDocuments ??
                        row.original.minRequiredDocuments ??
                        0
                    }
                />
            );
        },
    },
    {
        accessorKey: 'date',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const date = row.getValue('date') as Date;
            return <span>{format(date, 'dd.MM.yyyy')}</span>;
        },
    },
    {
        accessorKey: 'payeeCustomerName',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Customer
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isParent = row.original.splitType === 'parent';
            const customers = row.original.splitSummary?.customers ?? [];

            if (isParent && customers.length > 0) {
                const [first, ...rest] = customers;
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{first}</span>
                        {rest.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                +{rest.length} more
                            </span>
                        )}
                    </div>
                );
            }

            return (
                <CustomerColumn
                    customerName={row.original.payeeCustomerName}
                    payee={row.original.payee}
                />
            );
        },
    },
    {
        accessorKey: 'account',
        header: () => {
            return (
                <span className="text-sm text-muted-foreground">
                    Transaction
                </span>
            );
        },
        enableSorting: false,
        cell: ({ row }) => {
            const amount = row.original.amount;
            const isParent = row.original.splitType === 'parent';
            const splitSummary = row.original.splitSummary;

            if (isParent) {
                return (
                    <SplitAccountsColumn
                        creditAccounts={splitSummary?.creditAccounts ?? []}
                        debitAccounts={splitSummary?.debitAccounts ?? []}
                        singleAccounts={splitSummary?.singleAccounts ?? []}
                        amount={splitSummary?.totalAmount ?? amount}
                    />
                );
            }

            // Get double-entry validation issues for this transaction
            const validationIssues = validateTransaction(row.original).filter(
                (issue) => issue.type === 'double-entry',
            );

            return (
                <AccountColumn
                    account={row.original.account}
                    accountCode={row.original.accountCode}
                    accountIsOpen={row.original.accountIsOpen}
                    creditAccount={row.original.creditAccount}
                    creditAccountCode={row.original.creditAccountCode}
                    creditAccountIsOpen={row.original.creditAccountIsOpen}
                    creditAccountType={row.original.creditAccountType}
                    amount={amount}
                    debitAccount={row.original.debitAccount}
                    debitAccountCode={row.original.debitAccountCode}
                    debitAccountIsOpen={row.original.debitAccountIsOpen}
                    debitAccountType={row.original.debitAccountType}
                    validationIssues={validationIssues}
                />
            );
        },
    },
    {
        id: 'documents',
        header: () => (
            <span className="text-sm text-muted-foreground">Docs</span>
        ),
        enableSorting: false,
        cell: ({ row }) => {
            const isParent = row.original.splitType === 'parent';
            const splitSummary = row.original.splitSummary;
            return (
                <DocumentsColumn
                    documentCount={
                        splitSummary?.documentCount ??
                        row.original.documentCount ??
                        0
                    }
                    hasAllRequiredDocuments={
                        splitSummary?.hasAllRequiredDocuments ??
                        row.original.hasAllRequiredDocuments ??
                        true
                    }
                    requiredDocumentTypes={
                        splitSummary?.requiredDocumentTypes ??
                        row.original.requiredDocumentTypes ??
                        0
                    }
                    attachedRequiredTypes={
                        splitSummary?.attachedRequiredTypes ??
                        row.original.attachedRequiredTypes ??
                        0
                    }
                    status={
                        splitSummary?.status ?? row.original.status ?? 'pending'
                    }
                    transactionId={row.original.id}
                    minRequiredDocuments={
                        splitSummary?.minRequiredDocuments ??
                        row.original.minRequiredDocuments ??
                        0
                    }
                    readOnly={isParent}
                />
            );
        },
    },
    {
        accessorKey: 'tags',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Tags
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isParent = row.original.splitType === 'parent';
            const splitSummary = row.original.splitSummary;
            return (
                <TagsColumn
                    id={row.original.id}
                    tags={splitSummary?.tags ?? row.original.tags ?? []}
                    readOnly={isParent}
                />
            );
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => <Actions transaction={row.original} />,
    },
];
