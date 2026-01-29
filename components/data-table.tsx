'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Table } from '@signalco/ui-primitives/Table';
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
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onDelete?: (rows: Row<TData>[]) => void;
    onRowClick?: (row: Row<TData>) => void;
    disabled?: boolean;
    loading?: boolean;
    getRowClassName?: (row: TData) => string;
    autoPageSize?: boolean;
    rowHeight?: number;
    paginationKey?: string;
    autoResetPageIndex?: boolean;
    columnFilters?: ColumnFiltersState;
    onColumnFiltersChange?: (
        updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => void;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    onDelete,
    onRowClick,
    disabled,
    loading,
    getRowClassName,
    autoPageSize = false,
    rowHeight = 44.5,
    paginationKey,
    autoResetPageIndex = true,
    columnFilters: columnFiltersProp,
    onColumnFiltersChange,
}: DataTableProps<TData, TValue>) {
    const [ConfirmationDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to perform a bulk delete.',
    );

    const tableWrapperRef = React.useRef<HTMLDivElement>(null);
    const tableHeaderRef = React.useRef<HTMLTableSectionElement | null>(null);
    const paginationRef = React.useRef<HTMLDivElement>(null);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [internalColumnFilters, setInternalColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState({});
    const columnFilters = columnFiltersProp ?? internalColumnFilters;
    const handleColumnFiltersChange =
        onColumnFiltersChange ?? setInternalColumnFilters;
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

        // Get thead element from the table wrapper since signalco Table.Header doesn't support ref forwarding
        tableHeaderRef.current = tableWrapperRef.current?.querySelector('thead') ?? null;

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
        onColumnFiltersChange: handleColumnFiltersChange,
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
            {onDelete &&
                table.getFilteredSelectedRowModel().rows.length > 0 && (
                    <div className="flex items-center py-4">
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="outlined"
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
                    </div>
                )}
            <div ref={tableWrapperRef} className="rounded-md border">
                <Table>
                    <Table.Header>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <Table.Row key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <Table.Head key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </Table.Head>
                                    );
                                })}
                            </Table.Row>
                        ))}
                    </Table.Header>
                    <Table.Body>
                        {loading ? (
                            <Table.Row>
                                <Table.Cell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Loading...
                                </Table.Cell>
                            </Table.Row>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <Table.Row
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
                                        <Table.Cell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </Table.Cell>
                                    ))}
                                </Table.Row>
                            ))
                        ) : (
                            <Table.Row>
                                <Table.Cell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
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
                    variant="outlined"
                    size="sm"
                    className="px-2"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <Button
                    variant="outlined"
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
