"use client";

import { DataTable } from "@/components/data-table";
import { useBulkDeleteTransactions } from "@/features/transactions/api/use-bulk-delete-transactions";
import { useGetTransactions } from "@/features/transactions/api/use-get-transactions";
import { columns } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";

export function TransactionsDataTable() {
    const deleteTransactions = useBulkDeleteTransactions();
    const transactionsQuery = useGetTransactions();
    const transactions = transactionsQuery.data || [];

    const isDisabled = transactionsQuery.isLoading || deleteTransactions.isPending;

    return (
        <DataTable
            filterKey="payee"
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
            disabled={isDisabled} />
    );
}
