'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import type { ColumnFiltersState, Row } from '@tanstack/react-table';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { DataTableSearch } from '@/components/data-table-search';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useBulkDeleteCustomers } from '@/features/customers/api/use-bulk-delete-customers';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { useNewCustomer } from '@/features/customers/hooks/use-new-customer';
import { useOpenCustomer } from '@/features/customers/hooks/use-open-customer';
import { useConfirm } from '@/hooks/use-confirm';
import { columns, type ResponseType, selectColumn } from './columns';

const CustomersPage = () => {
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [ConfirmDialog, confirm] = useConfirm(
        'Delete customers?',
        'This action cannot be undone.',
    );
    const newCustomer = useNewCustomer();
    const { onOpen } = useOpenCustomer();
    const customersQuery = useGetCustomers();
    const bulkDeleteMutation = useBulkDeleteCustomers();
    const customers = customersQuery.data || [];

    const isDisabled = customersQuery.isLoading || bulkDeleteMutation.isPending;

    const handleBulkDelete = async (rows: Row<ResponseType>[]) => {
        const ok = await confirm();
        if (!ok) return;

        const ids = rows.map((row) => row.original.id);
        bulkDeleteMutation.mutate({ ids });
    };

    const handleRowClick = (row: Row<ResponseType>) => {
        onOpen(row.original.id);
    };

    // Add select column when in bulk delete mode
    const tableColumns = bulkDeleteMode ? [selectColumn, ...columns] : columns;

    if (customersQuery.isLoading) {
        return (
            <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
                <Card className="border-none drop-shadow-sm">
                    <CardHeader>
                        <Skeleton className="h-8 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-[500px] w-full flex items-center justify-center">
                            <Skeleton className="h-4 w-4 animate-spin" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
            <ConfirmDialog />
            <Card className="border-none drop-shadow-sm">
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>Customers</CardTitle>
                    <div className="flex flex-row items-center gap-x-2">
                        <Button onClick={newCustomer.onOpen} size="sm">
                            <Plus className="size-4 mr-2" />
                            Add new
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="plain">
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() =>
                                        setBulkDeleteMode(!bulkDeleteMode)
                                    }
                                >
                                    {bulkDeleteMode
                                        ? 'Cancel bulk delete'
                                        : 'Bulk delete'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex items-center">
                        <DataTableSearch
                            filterKey="name"
                            columnFilters={columnFilters}
                            onColumnFiltersChange={setColumnFilters}
                        />
                    </div>
                    <DataTable
                        paginationKey="customers"
                        columns={tableColumns}
                        data={customers}
                        onDelete={bulkDeleteMode ? handleBulkDelete : undefined}
                        onRowClick={bulkDeleteMode ? undefined : handleRowClick}
                        disabled={isDisabled}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomersPage;
