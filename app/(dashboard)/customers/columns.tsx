"use client";

import { InferResponseType } from "hono";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { client } from "@/lib/hono";
import { useOpenCustomer } from "@/features/customers/hooks/use-open-customer";
import { useDeleteCustomer } from "@/features/customers/api/use-delete-customer";
import { useConfirm } from "@/hooks/use-confirm";
import { Badge } from "@/components/ui/badge";

export type ResponseType = InferResponseType<typeof client.api.customers.$get, 200>["data"][0];

const ActionsCell = ({ row }: { row: { original: ResponseType } }) => {
    const [ConfirmDialog, confirm] = useConfirm(
        "Are you sure?",
        "You are about to delete this customer."
    );

    const deleteMutation = useDeleteCustomer(row.original.id);
    const { onOpen } = useOpenCustomer();

    const handleDelete = async () => {
        const ok = await confirm();

        if (ok) {
            deleteMutation.mutate();
        }
    };

    return (
        <>
            <ConfirmDialog />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={() => onOpen(row.original.id)}
                    >
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                    >
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};

export const columns: ColumnDef<ResponseType>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected()}
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
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-2">
                    <span>{row.getValue("name")}</span>
                    {!row.original.isComplete && (
                        <Badge variant="secondary" className="text-xs">
                            Incomplete
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "pin",
        header: "PIN",
        cell: ({ row }) => {
            const pin = row.getValue("pin") as string;
            return <div>{pin || "-"}</div>;
        },
    },
    {
        accessorKey: "vatNumber",
        header: "VAT Number",
        cell: ({ row }) => {
            const vatNumber = row.getValue("vatNumber") as string;
            return <div>{vatNumber || "-"}</div>;
        },
    },
    {
        accessorKey: "contactEmail",
        header: "Email",
        cell: ({ row }) => {
            const email = row.getValue("contactEmail") as string;
            return <div>{email || "-"}</div>;
        },
    },
    {
        accessorKey: "contactTelephone",
        header: "Phone",
        cell: ({ row }) => {
            const phone = row.getValue("contactTelephone") as string;
            return <div>{phone || "-"}</div>;
        },
    },
    {
        accessorKey: "transactionCount",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Transactions
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const count = row.getValue("transactionCount") as number;
            return <div>{count}</div>;
        },
    },
    {
        id: "actions",
        cell: ActionsCell,
    },
];
