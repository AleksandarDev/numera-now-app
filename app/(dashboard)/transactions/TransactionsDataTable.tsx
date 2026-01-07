"use client";

import { DataTable } from "@/components/data-table";
import { useGetTransactions } from "@/features/transactions/api/use-get-transactions";
import { columns, ResponseType } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import { hasValidationIssues } from "./validation";

export function TransactionsDataTable() {
    const transactionsQuery = useGetTransactions();
    const transactions = transactionsQuery.data || [];
    const isLoading = transactionsQuery.isLoading;

    const getRowClassName = (transaction: ResponseType) => {
        if (isLoading) return "";
        if (transaction.status === "draft") {
            return "bg-gray-50 hover:bg-gray-100 opacity-60 italic";
        }
        if (transaction.splitType === "child") {
            return "bg-slate-50 hover:bg-slate-100";
        }
        return hasValidationIssues(transaction) ? "bg-red-50 hover:bg-red-100" : "";
    };

    return (
        <DataTable
            filterKey="payeeCustomerName"
            filterPlaceholder="Filter transactions..."
            columns={transactionsQuery.isLoading
                ? columns.map((column) => ({ ...column, cell: () => <Skeleton className="h-[14px] w-[100%] rounded-sm" /> }))
                : columns}
            data={transactionsQuery.isLoading
                ? Array(5).fill({})
                : transactions}
            disabled={isLoading}
            getRowClassName={getRowClassName} />
    );
}
