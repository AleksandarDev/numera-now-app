"use client"

import { InferResponseType } from "hono";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { client } from "@/lib/hono";
import { Actions } from "./actions";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AccountColumn } from "./account-column";
import { CategoryColumn } from "./category-column";
import { CustomerColumn } from "./customer-column";
import { DocumentsColumn } from "./documents-column";
import { StatusColumn } from "./status-column";

export type ResponseType = InferResponseType<typeof client.api.transactions.$get, 200>["data"][0];

export const columns: ColumnDef<ResponseType>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <StatusColumn
          transactionId={row.original.id}
          status={row.original.status ?? "pending"}
          transaction={{
            date: row.original.date,
            amount: row.original.amount,
            payeeCustomerId: row.original.payeeCustomerId,
            payee: row.original.payee,
            categoryId: row.original.categoryId,
            notes: row.original.notes,
            accountId: row.original.accountId,
            creditAccountId: row.original.creditAccountId,
            debitAccountId: row.original.debitAccountId,
            splitGroupId: row.original.splitGroupId,
            splitType: row.original.splitType,
          }}
          hasAllRequiredDocuments={row.original.hasAllRequiredDocuments ?? true}
          requiredDocumentTypes={row.original.requiredDocumentTypes ?? 0}
          attachedRequiredTypes={row.original.attachedRequiredTypes ?? 0}
          minRequiredDocuments={(row.original as any).minRequiredDocuments ?? 0}
        />
      );
    }
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue("date") as Date;
      return (
        <span>
          {format(date, "MMMM dd, yyyy")}
        </span>
      )
    }
  },
  {
    accessorKey: "payeeCustomerName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const isChild = row.original.splitType === "child";
      return (
        <div className={isChild ? "pl-4" : undefined}>
          {isChild ? <span className="mr-1 text-muted-foreground">↳</span> : null}
          <CustomerColumn
            customerName={row.original.payeeCustomerName}
            payee={row.original.payee}
          />
        </div>
      );
    },
  },
  {
    accessorKey: "account",
    header: () => {
      return (
        <span className="text-sm text-muted-foreground">Transaction</span>
      )
    },
    enableSorting: false,
    cell: ({ row }) => {
      const amount = row.original.amount;
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
        />
      )
    }
  },
  {
    id: "split",
    header: () => (
      <span className="text-sm text-muted-foreground">Split</span>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      if (!row.original.splitGroupId) return null;
      const isParent = row.original.splitType === "parent";
      return (
        <Badge variant={isParent ? "default" : "outline"} className="px-2 py-1 text-[11px]">
          {isParent ? "Split" : "Part"}
        </Badge>
      );
    }
  },
  {
    id: "documents",
    header: () => (
      <span className="text-sm text-muted-foreground">Docs</span>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      return (
        <DocumentsColumn
          documentCount={row.original.documentCount ?? 0}
          hasAllRequiredDocuments={row.original.hasAllRequiredDocuments ?? true}
          requiredDocumentTypes={row.original.requiredDocumentTypes ?? 0}
          attachedRequiredTypes={row.original.attachedRequiredTypes ?? 0}
          status={row.original.status ?? "pending"}
          transactionId={row.original.id}
          minRequiredDocuments={(row.original as any).minRequiredDocuments ?? 0}
        />
      );
    }
  },
  {
    accessorKey: "category",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <CategoryColumn
          id={row.original.id}
          category={row.original.category}
          categoryId={row.original.categoryId}
        />
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => <Actions transaction={row.original} />
  }
]
