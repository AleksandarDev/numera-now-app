'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import type { InferResponseType } from 'hono';
import {
    ArrowUpDown,
    Building2,
    ExternalLink,
    MoreHorizontal,
    TriangleAlert,
} from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteCustomer } from '@/features/customers/api/use-delete-customer';
import { useOpenCustomer } from '@/features/customers/hooks/use-open-customer';
import { useConfirm } from '@/hooks/use-confirm';
import { getCountryByCode } from '@/lib/countries';
import type { client } from '@/lib/hono';

export type ResponseType = InferResponseType<
    typeof client.api.customers.$get,
    200
>['data'][0];

// Separate select column for conditional rendering
export const selectColumn: ColumnDef<ResponseType> = {
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
};

const ActionsCell = ({ row }: { row: { original: ResponseType } }) => {
    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this customer.',
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
                    <Button variant="plain" className="h-8 w-8 p-0">
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

const CustomerAvatar = ({ customer }: { customer: ResponseType }) => {
    const displayName = customer.friendlyName || customer.name;
    const initial = displayName.trim().charAt(0).toUpperCase() || '?';

    if (customer.avatarImage) {
        return (
            <Image
                src={customer.avatarImage}
                alt={`${displayName} favicon`}
                width={24}
                height={24}
                className="size-6 shrink-0 rounded-sm border bg-background object-contain"
                unoptimized
            />
        );
    }

    return (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border bg-muted text-xs font-medium text-muted-foreground">
            {initial}
        </span>
    );
};

const formatWebsiteLabel = (website: string) => {
    try {
        const url = new URL(website);
        return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
    } catch {
        return website;
    }
};

export const columns: ColumnDef<ResponseType>[] = [
    {
        id: 'select',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected()}
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
            const displayName = row.original.friendlyName || row.original.name;

            return (
                <div className="flex min-w-0 items-center gap-3">
                    <CustomerAvatar customer={row.original} />
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {!row.original.isComplete && (
                            <Badge variant="destructive" className="text-xs">
                                <TriangleAlert className="size-4 mr-2" />
                                Incomplete
                            </Badge>
                        )}
                        {row.original.isOwnFirm && (
                            <Badge variant="secondary" className="text-xs">
                                <Building2 className="size-4 mr-2" />
                                Own Firm
                            </Badge>
                        )}
                        <span className="truncate">{displayName}</span>
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: 'website',
        header: 'Website',
        cell: ({ row }) => {
            const website = row.getValue('website') as string | null;
            if (!website) {
                return <div>-</div>;
            }

            return (
                <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-48 items-center gap-1 truncate text-sm text-blue-600 hover:underline"
                >
                    <span className="truncate">
                        {formatWebsiteLabel(website)}
                    </span>
                    <ExternalLink className="size-3 shrink-0" />
                </a>
            );
        },
    },
    {
        accessorKey: 'vatNumber',
        header: 'VAT Number',
        cell: ({ row }) => {
            const vatNumber = row.getValue('vatNumber') as string;
            return <div>{vatNumber || '-'}</div>;
        },
    },
    {
        accessorKey: 'contactEmail',
        header: 'Email',
        cell: ({ row }) => {
            const email = row.getValue('contactEmail') as string;
            return <div>{email || '-'}</div>;
        },
    },
    {
        accessorKey: 'country',
        header: 'Country',
        cell: ({ row }) => {
            const code = row.getValue('country') as string | null;
            if (!code) return <div>-</div>;
            const country = getCountryByCode(code);
            return (
                <div className="flex items-center gap-1">
                    {country ? (
                        <>
                            <span>{country.flag}</span>
                            <span>{country.name}</span>
                        </>
                    ) : (
                        code
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'transactionCount',
        header: ({ column }) => {
            return (
                <Button
                    variant="plain"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Transactions
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const count = row.getValue('transactionCount') as number;
            return <div>{count}</div>;
        },
    },
    {
        id: 'actions',
        cell: ActionsCell,
    },
];
