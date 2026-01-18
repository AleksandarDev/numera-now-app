'use client';

import type { ColumnFiltersState, Row } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { useBulkDeleteTransactions } from '@/features/transactions/api/use-bulk-delete-transactions';
import { useGetTransactions } from '@/features/transactions/api/use-get-transactions';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { columns, type ResponseType, selectColumn } from './columns';
import { hasValidationIssues } from './validation';

type TransactionsDataTableProps = {
    bulkDeleteMode?: boolean;
    columnFilters?: ColumnFiltersState;
    onColumnFiltersChange?: (
        updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => void;
};

export function TransactionsDataTable({
    bulkDeleteMode = false,
    columnFilters,
    onColumnFiltersChange,
}: TransactionsDataTableProps) {
    const transactionsQuery = useGetTransactions();
    const bulkDeleteMutation = useBulkDeleteTransactions();
    const { onOpen } = useOpenTransaction();
    const transactions = transactionsQuery.data || [];
    // Use isLoading only for initial load (no cached data)
    // isFetching is true during background refetch but we keep showing cached data
    const isInitialLoading = transactionsQuery.isLoading;
    const isDeleting = bulkDeleteMutation.isPending;

    const getRowClassName = (transaction: ResponseType) => {
        if (isInitialLoading) return '';
        const displayStatus =
            transaction.splitSummary?.status ?? transaction.status;
        if (displayStatus === 'draft') {
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

    const handleRowClick = (row: Row<ResponseType>) => {
        onOpen(row.original.id);
    };

    // Add select column when in bulk delete mode
    const tableColumns = bulkDeleteMode ? [selectColumn, ...columns] : columns;

    return (
        <DataTable
            autoPageSize
            rowHeight={48}
            paginationKey="transactions"
            autoResetPageIndex={false}
            columns={
                isInitialLoading
                    ? tableColumns.map((column) => ({
                          ...column,
                          cell: () => (
                              <Skeleton className="h-[14px] w-[100%] rounded-sm" />
                          ),
                      }))
                    : tableColumns
            }
            data={isInitialLoading ? Array(5).fill({}) : transactions}
            disabled={isInitialLoading || isDeleting}
            loading={isDeleting}
            onDelete={bulkDeleteMode ? handleBulkDelete : undefined}
            onRowClick={bulkDeleteMode ? undefined : handleRowClick}
            getRowClassName={getRowClassName}
            columnFilters={columnFilters}
            onColumnFiltersChange={onColumnFiltersChange}
        />
    );
}
