'use client';

import { useMemo } from 'react';
import {
    ChartConfigurable,
    ChartConfigurableLoading,
} from '@/components/chart-configurable';
import { useGetSummary } from '@/features/summary/api/use-get-summary';
import { accumulateData } from '@/lib/utils';
import type { GraphWidgetConfig } from '@/lib/widgets/types';

interface GraphWidgetProps {
    config: GraphWidgetConfig;
}

export function GraphWidget({ config }: GraphWidgetProps) {
    const { data, isLoading } = useGetSummary();

    const chartData = config.dataSource === 'transactions' ? data?.days : [];

    // Apply accumulation if configured
    const processedData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        const accumulation = config.accumulation ?? 'none';
        return accumulateData(chartData, accumulation);
    }, [chartData, config.accumulation]);

    if (isLoading) {
        return <ChartConfigurableLoading />;
    }

    const title =
        config.dataSource === 'transactions'
            ? `Transactions Over Time${config.accumulation && config.accumulation !== 'none' ? ` (${config.accumulation === 'week' ? 'Weekly' : 'Monthly'})` : ''}`
            : 'Tags Over Time';

    return (
        <ChartConfigurable
            title={title}
            data={processedData}
            chartType={config.chartType}
            isLoading={isLoading}
        />
    );
}
