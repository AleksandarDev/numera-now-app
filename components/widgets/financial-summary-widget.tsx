'use client';

import {
    FaBalanceScale,
    FaBalanceScaleLeft,
    FaBalanceScaleRight,
} from 'react-icons/fa';
import { FaArrowTrendDown, FaArrowTrendUp } from 'react-icons/fa6';
import { DataCard, DataCardLoading } from '@/components/data-card';
import { useGetAccount } from '@/features/accounts/api/use-get-account';
import { useGetSummary } from '@/features/summary/api/use-get-summary';
import type { FinancialSummaryWidgetConfig } from '@/lib/widgets/types';

interface FinancialSummaryWidgetProps {
    config: FinancialSummaryWidgetConfig;
}

export function FinancialSummaryWidget({
    config,
}: FinancialSummaryWidgetProps) {
    // Fetch summary data with optional account filter
    const { data, isLoading } = useGetSummary(config.accountId);

    // Fetch account data if accountId is provided
    const { data: accountData } = useGetAccount(config.accountId);

    // Determine source label (account name/code or "Total")
    const sourceLabel =
        config.accountId && accountData
            ? `${accountData.code ? `${accountData.code} - ` : ''}${accountData.name}`
            : 'Total';

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
                dateRange={sourceLabel}
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
                dateRange={sourceLabel}
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
                dateRange={sourceLabel}
            />
        );
    }

    return null;
}
