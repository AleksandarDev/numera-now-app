'use client';

import { useGetSummary } from '@/features/summary/api/use-get-summary';
import {
    ChartConfigurable,
    ChartConfigurableLoading,
} from '@/components/chart-configurable';
import type { GraphWidgetConfig } from '@/lib/widgets/types';

interface GraphWidgetProps {
    config: GraphWidgetConfig;
}

export function GraphWidget({ config }: GraphWidgetProps) {
    const { data, isLoading } = useGetSummary();

    const chartData = config.dataSource === 'transactions' ? data?.days : [];

    if (isLoading) {
        return (
            <ChartConfigurableLoading
                title={
                    config.dataSource === 'transactions'
                        ? 'Transactions Over Time'
                        : 'Tags Over Time'
                }
            />
        );
    }

    return (
        <ChartConfigurable
            title={
                config.dataSource === 'transactions'
                    ? 'Transactions Over Time'
                    : 'Tags Over Time'
            }
            data={chartData}
            chartType={config.chartType}
            isLoading={isLoading}
        />
    );
}
