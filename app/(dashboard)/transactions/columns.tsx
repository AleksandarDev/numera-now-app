"use client"

import { InferResponseType } from "hono";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { client } from "@/lib/hono";
import { Actions } from "./actions";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AccountColumn } from "./account-column";
import { CategoryColumn } from "./category-column";
import { CustomerColumn } from "./customer-column";

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
    accessorKey: "amount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      return (
        <Badge
          variant={amount < 0 ? "destructive" : "primary"}
          className="px-3 py-2 text-sm"
        >
          {formatCurrency(amount)}
        </Badge>
      )
    }
  },
  {
    id: "split",
    header: () => (
      <span className="text-xs uppercase text-muted-foreground">Split</span>
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
      const status = row.getValue("status") as string;
      const statusVariants = {
        draft: "secondary",
        pending: "outline",
        completed: "default",
        reconciled: "default",
      } as const;
      
      const statusColors = {
        draft: "text-muted-foreground",
        pending: "text-yellow-600",
        completed: "text-blue-600",
        reconciled: "text-green-600",
      } as const;
      
      return (
        <Badge
          variant={statusVariants[status as keyof typeof statusVariants] || "outline"}
          className={`px-2 py-1 text-xs ${statusColors[status as keyof typeof statusColors] || ""}`}
        >
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
        </Badge>
      )
    }
  },
  {
    accessorKey: "account",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Account
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <AccountColumn
          account={row.original.account}
          accountCode={row.original.accountCode}
          accountIsOpen={row.original.accountIsOpen}
          creditAccount={row.original.creditAccount}
          creditAccountCode={row.original.creditAccountCode}
          creditAccountIsOpen={row.original.creditAccountIsOpen}
          debitAccount={row.original.debitAccount}
          debitAccountCode={row.original.debitAccountCode}
          debitAccountIsOpen={row.original.debitAccountIsOpen}
        />
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => <Actions transaction={row.original} />
  }
]
