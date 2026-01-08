'use client';

import type { Row } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useBulkDeleteTransactions } from '@/features/transactions/api/use-bulk-delete-transactions';
import { useGetTransactions } from '@/features/transactions/api/use-get-transactions';
import { columns, type ResponseType, selectColumn } from './columns';
import { hasValidationIssues } from './validation';

type TransactionsDataTableProps = {
    bulkDeleteMode?: boolean;
};

export function TransactionsDataTable({
    bulkDeleteMode = false,
}: TransactionsDataTableProps) {
    const transactionsQuery = useGetTransactions();
    const bulkDeleteMutation = useBulkDeleteTransactions();
    const transactions = transactionsQuery.data || [];
    const isLoading = transactionsQuery.isLoading;
    const isDeleting = bulkDeleteMutation.isPending;

    const getRowClassName = (transaction: ResponseType) => {
        if (isLoading) return '';
        if (transaction.status === 'draft') {
            return 'bg-gray-50 hover:bg-gray-100 opacity-60 italic';
        }
        if (transaction.splitType === 'child') {
            return 'bg-slate-50 hover:bg-slate-100';
        }
        return hasValidationIssues(transaction)
            ? 'bg-red-50 hover:bg-red-100'
            : '';
    };

    const handleBulkDelete = (rows: Row<ResponseType>[]) => {
        const ids = rows.map((row) => row.original.id);
        bulkDeleteMutation.mutate({ ids });
    };

    // Add select column when in bulk delete mode
    const tableColumns = bulkDeleteMode ? [selectColumn, ...columns] : columns;

    return (
        <DataTable
            filterKey="payeeCustomerName"
            filterPlaceholder="Filter transactions..."
            columns={
                transactionsQuery.isLoading
                    ? tableColumns.map((column) => ({
                          ...column,
                          cell: () => (
                              <Skeleton className="h-[14px] w-[100%] rounded-sm" />
                          ),
                      }))
                    : tableColumns
            }
            data={
                transactionsQuery.isLoading ? Array(5).fill({}) : transactions
            }
            disabled={isLoading || isDeleting}
            loading={isDeleting}
            onDelete={bulkDeleteMode ? handleBulkDelete : undefined}
            getRowClassName={getRowClassName}
        />
    );
}
