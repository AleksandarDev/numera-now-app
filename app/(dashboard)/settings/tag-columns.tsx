'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { InferResponseType } from 'hono';
import { ArrowUpDown, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteTag } from '@/features/tags/api/use-delete-tag';
import { useOpenTag } from '@/features/tags/hooks/use-open-tag';
import { useConfirm } from '@/hooks/use-confirm';
import type { client } from '@/lib/hono';

export type ResponseType = InferResponseType<
    typeof client.api.tags.$get,
    200
>['data'][0];

const Actions = ({ id }: { id: string }) => {
    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this tag.',
    );

    const deleteMutation = useDeleteTag(id);
    const { onOpen } = useOpenTag();

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
                    <Button variant="ghost" className="size-8 p-0">
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={() => onOpen(id)}
                    >
                        <Pencil className="mr-2 size-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                    >
                        <Trash className="mr-2 size-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};

export const tagColumns: ColumnDef<ResponseType>[] = [
    {
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
    },
    {
        accessorKey: 'name',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const color = row.original.color;
            return (
                <div className="flex items-center gap-2">
                    {color && (
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                    )}
                    <span>{row.original.name}</span>
                </div>
            );
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => <Actions id={row.original.id} />,
    },
];
