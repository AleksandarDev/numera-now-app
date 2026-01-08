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
    onRowClick?: (row: Row<TData>) => void;
    disabled?: boolean;
    loading?: boolean;
    getRowClassName?: (row: TData) => string;
    autoPageSize?: boolean;
    rowHeight?: number;
    paginationKey?: string;
    autoResetPageIndex?: boolean;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filterKey,
    filterPlaceholder,
    onDelete,
    onRowClick,
    disabled,
    loading,
    getRowClassName,
    autoPageSize = false,
    rowHeight = 44.5,
    paginationKey,
    autoResetPageIndex = true,
}: DataTableProps<TData, TValue>) {
    const [ConfirmationDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to perform a bulk delete.',
    );

    const tableWrapperRef = React.useRef<HTMLDivElement>(null);
    const tableHeaderRef = React.useRef<HTMLTableSectionElement>(null);
    const paginationRef = React.useRef<HTMLDivElement>(null);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState({});
    const pageQueryKey = paginationKey ? `${paginationKey}Page` : 'page';
    const pageSizeQueryKey = paginationKey
        ? `${paginationKey}PageSize`
        : 'pageSize';
    const [pageParam, setPageParam] = useQueryState(
        pageQueryKey,
        parseAsInteger.withDefault(1),
    );
    const [pageSizeParam, setPageSizeParam] = useQueryState(
        pageSizeQueryKey,
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

    const recalcPageSize = React.useCallback(() => {
        if (!autoPageSize) return;
        if (!tableWrapperRef.current || !tableHeaderRef.current) return;

        const tableTop = tableWrapperRef.current.getBoundingClientRect().top;
        const headerHeight =
            tableHeaderRef.current.getBoundingClientRect().height;
        const paginationHeight =
            paginationRef.current?.getBoundingClientRect().height ?? 0;
        const availableHeight =
            window.innerHeight - tableTop - paginationHeight;
        const nextPageSize = Math.max(
            1,
            Math.floor((availableHeight - headerHeight) / rowHeight),
        );

        if (nextPageSize !== pageSizeParam) {
            void setPageSizeParam(nextPageSize);
        }
    }, [autoPageSize, pageSizeParam, rowHeight, setPageSizeParam]);

    React.useEffect(() => {
        if (!autoPageSize) return;

        recalcPageSize();
        const handleResize = () => recalcPageSize();
        window.addEventListener('resize', handleResize);

        const observer = new ResizeObserver(() => recalcPageSize());
        if (tableWrapperRef.current) {
            observer.observe(tableWrapperRef.current);
        }
        if (tableHeaderRef.current) {
            observer.observe(tableHeaderRef.current);
        }
        if (paginationRef.current) {
            observer.observe(paginationRef.current);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [autoPageSize, recalcPageSize]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        autoResetPageIndex,
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

    const shouldIgnoreRowClick = (target: HTMLElement | null) => {
        if (!target) return false;
        return Boolean(
            target.closest(
                'button, a, input, select, textarea, label, [role="button"], [role="menuitem"], [data-row-interactive]',
            ),
        );
    };

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
            <div ref={tableWrapperRef} className="rounded-md border">
                <Table>
                    <TableHeader ref={tableHeaderRef}>
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
                                        (onDelete || onRowClick) &&
                                            'cursor-pointer',
                                    )}
                                    onClick={(event) => {
                                        if (
                                            shouldIgnoreRowClick(
                                                event.target as HTMLElement | null,
                                            )
                                        ) {
                                            return;
                                        }
                                        if (onDelete) {
                                            row.toggleSelected();
                                            return;
                                        }
                                        onRowClick?.(row);
                                    }}
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
            <div
                ref={paginationRef}
                className="flex items-center justify-end space-x-2 py-4"
            >
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
