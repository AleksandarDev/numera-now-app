'use client';

import { parseAsString, useQueryStates } from 'nuqs';
import {
    FaBalanceScale,
    FaBalanceScaleLeft,
    FaBalanceScaleRight,
} from 'react-icons/fa';
import { FaArrowTrendDown, FaArrowTrendUp } from 'react-icons/fa6';
import { useGetSummary } from '@/features/summary/api/use-get-summary';
import { formatDateRange } from '@/lib/utils';
import { DataCard, DataCardLoading } from '@/components/data-card';
import type { FinancialSummaryWidgetConfig } from '@/lib/widgets/types';

interface FinancialSummaryWidgetProps {
    config: FinancialSummaryWidgetConfig;
}

export function FinancialSummaryWidget({
    config,
}: FinancialSummaryWidgetProps) {
    const { data, isLoading } = useGetSummary();
    const [{ from, to }] = useQueryStates({
        from: parseAsString,
        to: parseAsString,
    });

    const dateRangeLabel = formatDateRange({
        to: to ?? undefined,
        from: from ?? undefined,
    });

    if (isLoading) {
        return <DataCardLoading />;
    }

    // Determine which card to display based on summaryType config
    if (config.summaryType === 'balance') {
        const balanced = Math.abs(data?.remainingAmount ?? 0) < 100;
        const balancePositive = (data?.remainingAmount ?? 0) > 100;

        return (
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
        );
    }

    if (config.summaryType === 'income') {
        return (
            <DataCard
                title="Income"
                value={data?.incomeAmount}
                percentageChange={data?.incomeChange}
                icon={FaArrowTrendUp}
                variant="success"
                dateRange={dateRangeLabel}
            />
        );
    }

    if (config.summaryType === 'expenses') {
        return (
            <DataCard
                title="Expenses"
                value={data?.expensesAmount}
                percentageChange={data?.expensesChange}
                icon={FaArrowTrendDown}
                variant="danger"
                dateRange={dateRangeLabel}
            />
        );
    }

    return null;
}
