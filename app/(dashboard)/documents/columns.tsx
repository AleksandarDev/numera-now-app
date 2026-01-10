'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { InferResponseType } from 'hono';
import { ArrowUpDown, FileText, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { client } from '@/lib/hono';
import { DocumentActions } from './actions';

export type ResponseType = InferResponseType<
    typeof client.api.documents.$get,
    200
>['data'][0];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface GetColumnsProps {
    onDownload: (documentId: string) => void;
    onDelete: (documentId: string) => void;
    isDeleting?: boolean;
}

export const getColumns = ({
    onDownload,
    onDelete,
    isDeleting,
}: GetColumnsProps): ColumnDef<ResponseType>[] => [
    {
        accessorKey: 'fileName',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    File Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">
                        {row.getValue('fileName')}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'documentTypeName',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Type
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return row.getValue('documentTypeName') || 'Unknown';
        },
    },
    {
        accessorKey: 'fileSize',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Size
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return formatFileSize(row.getValue('fileSize'));
        },
    },
    {
        accessorKey: 'uploadedAt',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Uploaded
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return format(new Date(row.getValue('uploadedAt')), 'MMM d, yyyy');
        },
    },
    {
        id: 'transaction',
        header: 'Transaction',
        cell: ({ row }) => {
            const doc = row.original;
            return (
                <div className="flex items-center">
                    {doc.transactionId ? (
                        <div className="flex items-center text-sm">
                            <Link2 className="mr-1 h-3 w-3" />
                            {doc.transactionDate
                                ? format(new Date(doc.transactionDate), 'MMM d')
                                : 'View'}
                            {doc.transactionPayee &&
                                ` - ${doc.transactionPayee.slice(0, 15)}...`}
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-sm">
                            Not attached
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
            return (
                <DocumentActions
                    documentId={row.original.id}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    isDeleting={isDeleting}
                />
            );
        },
    },
];
