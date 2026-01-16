'use client';

import * as React from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DataTableSearchProps {
    columnFilters: ColumnFiltersState;
    onColumnFiltersChange: (
        updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => void;
    filterKey: string;
    placeholder?: string;
    className?: string;
}

export function DataTableSearch({
    columnFilters,
    onColumnFiltersChange,
    filterKey,
    placeholder,
    className,
}: DataTableSearchProps) {
    const value = React.useMemo(() => {
        const match = columnFilters.find((filter) => filter.id === filterKey);
        return typeof match?.value === 'string' ? match.value : '';
    }, [columnFilters, filterKey]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        onColumnFiltersChange((prev) => {
            const nextFilters = prev.filter(
                (filter) => filter.id !== filterKey,
            );

            if (nextValue) {
                nextFilters.push({ id: filterKey, value: nextValue });
            }

            return nextFilters;
        });
    };

    return (
        <Input
            placeholder={placeholder ?? `Filter ${filterKey}...`}
            value={value}
            onChange={handleChange}
            className={cn('max-w-sm', className)}
        />
    );
}
