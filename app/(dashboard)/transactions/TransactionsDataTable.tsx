"use client";

import { DataTable } from "@/components/data-table";
import { useBulkDeleteTransactions } from "@/features/transactions/api/use-bulk-delete-transactions";
import { useGetTransactions } from "@/features/transactions/api/use-get-transactions";
import { columns, ResponseType } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import { hasValidationIssues } from "./validation";

export function TransactionsDataTable() {
    const deleteTransactions = useBulkDeleteTransactions();
    const transactionsQuery = useGetTransactions();
    const transactions = transactionsQuery.data || [];

    const isDisabled = transactionsQuery.isLoading || deleteTransactions.isPending;

    const getRowClassName = (transaction: ResponseType) => {
        return hasValidationIssues(transaction) ? "bg-red-50 hover:bg-red-100" : "";
    };

    return (
        <DataTable
            filterKey="payeeCustomerName"
            columns={transactionsQuery.isLoading
                ? columns.map((column) => ({ ...column, cell: () => <Skeleton className="h-[14px] w-[100%] rounded-sm" /> }))
                : columns}
            data={transactionsQuery.isLoading
                ? Array(5).fill({})
                : transactions}
            onDelete={(row) => {
                const ids = row.map((r) => r.original.id);
                deleteTransactions.mutate({ ids });
            }}
            disabled={isDisabled}
            getRowClassName={getRowClassName} />
    );
}
