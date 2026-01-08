'use client';

import { useSearchParams } from 'next/navigation';
import {
    FaBalanceScale,
    FaBalanceScaleLeft,
    FaBalanceScaleRight,
} from 'react-icons/fa';
import { FaArrowTrendDown, FaArrowTrendUp } from 'react-icons/fa6';

import { useGetSummary } from '@/features/summary/api/use-get-summary';
import { formatDateRange } from '@/lib/utils';

import { DataCard, DataCardLoading } from './data-card';

export const DataGrid = () => {
    const { data, isLoading } = useGetSummary();
    const searchParams = useSearchParams();
    const to = searchParams.get('to') || undefined;
    const from = searchParams.get('from') || undefined;

    const dateRangeLabel = formatDateRange({ to, from });

    if (isLoading)
        return (
            <div className="mb-8 grid grid-cols-1 gap-8 pb-2 lg:grid-cols-3">
                <DataCardLoading />
                <DataCardLoading />
                <DataCardLoading />
            </div>
        );

    const balanced = Math.abs(data?.remainingAmount ?? 0) < 100;
    const balancePositive = (data?.remainingAmount ?? 0) > 100;

    return (
        <div className="mb-8 grid grid-cols-1 gap-8 pb-2 lg:grid-cols-3">
            <DataCard
                title="Balance"
                value={data?.remainingAmount}
                percentageChange={data?.remainingChange}
                icon={
                    balanced
                        ? FaBalanceScale
                        : balancePositive
                          ? FaBalanceScaleRight
                          : FaBalanceScaleLeft
                }
                variant={
                    balanced
                        ? 'default'
                        : balancePositive
                          ? 'success'
                          : 'danger'
                }
                dateRange={dateRangeLabel}
            />
            <DataCard
                title="Income"
                value={data?.incomeAmount}
                percentageChange={data?.incomeChange}
                icon={FaArrowTrendUp}
                variant="success"
                dateRange={dateRangeLabel}
            />
            <DataCard
                title="Expenses"
                value={data?.expensesAmount}
                percentageChange={data?.expensesChange}
                icon={FaArrowTrendDown}
                variant="danger"
                dateRange={dateRangeLabel}
            />
        </div>
    );
};
