'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import type { InferResponseType } from 'hono';
import { ArrowUpDown, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteTag } from '@/features/tags/api/use-delete-tag';
import { TagBadge } from '@/features/tags/components/tag-badge';
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
                    <Button variant="plain" className="size-8 p-0">
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
                    variant="plain"
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
            return (
                <TagBadge
                    name={row.original.name}
                    color={row.original.color}
                    size="sm"
                />
            );
        },
    },
    {
        accessorKey: 'tagType',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
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
            const tagType = row.original.tagType || 'general';
            return <span className="capitalize">{tagType}</span>;
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => <Actions id={row.original.id} />,
    },
];
