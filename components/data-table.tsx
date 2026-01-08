'use client';

import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type PaginationState,
    type Row,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Trash } from 'lucide-react';
import { parseAsInteger, useQueryState } from 'nuqs';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    filterKey?: string;
    filterPlaceholder?: string;
    onDelete?: (rows: Row<TData>[]) => void;
    disabled?: boolean;
    loading?: boolean;
    getRowClassName?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filterKey,
    filterPlaceholder,
    onDelete,
    disabled,
    loading,
    getRowClassName,
}: DataTableProps<TData, TValue>) {
    const [ConfirmationDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to perform a bulk delete.',
    );

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState({});
    const [pageParam, setPageParam] = useQueryState(
        'page',
        parseAsInteger.withDefault(1),
    );
    const [pageSizeParam, setPageSizeParam] = useQueryState(
        'pageSize',
        parseAsInteger.withDefault(10),
    );

    const pagination = React.useMemo<PaginationState>(
        () => ({
            pageIndex: Math.max(0, pageParam - 1),
            pageSize: Math.max(1, pageSizeParam),
        }),
        [pageParam, pageSizeParam],
    );

    const handlePaginationChange = React.useCallback(
        (
            updater:
                | PaginationState
                | ((prev: PaginationState) => PaginationState),
        ) => {
            const next =
                typeof updater === 'function' ? updater(pagination) : updater;
            void setPageParam(next.pageIndex + 1);
            void setPageSizeParam(next.pageSize);
        },
        [pagination, setPageParam, setPageSizeParam],
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onRowSelectionChange: setRowSelection,
        onPaginationChange: handlePaginationChange,
        state: {
            sorting,
            columnFilters,
            rowSelection,
            pagination,
        },
    });

    return (
        <div>
            <ConfirmationDialog />
            <div className="flex items-center py-4">
                {filterKey && (
                    <Input
                        placeholder={
                            filterPlaceholder ?? `Filter ${filterKey}...`
                        }
                        value={
                            (table
                                .getColumn(filterKey)
                                ?.getFilterValue() as string) ?? ''
                        }
                        onChange={(event) =>
                            table
                                .getColumn(filterKey)
                                ?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                    />
                )}
                {onDelete &&
                    table.getFilteredSelectedRowModel().rows.length > 0 && (
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            onClick={async () => {
                                const ok = await confirm();

                                if (ok) {
                                    onDelete(
                                        table.getFilteredSelectedRowModel()
                                            .rows,
                                    );
                                    table.resetRowSelection();
                                }
                            }}
                        >
                            <Trash className="size-4 mr-2" />
                            Delete (
                            {table.getFilteredSelectedRowModel().rows.length})
                        </Button>
                    )}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && 'selected'
                                    }
                                    className={cn(
                                        getRowClassName
                                            ? getRowClassName(row.original)
                                            : undefined,
                                        onDelete && 'cursor-pointer',
                                    )}
                                    onClick={
                                        onDelete
                                            ? () => row.toggleSelected()
                                            : undefined
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
