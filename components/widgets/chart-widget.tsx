'use client';

import { useGetSummary } from '@/features/summary/api/use-get-summary';
import {
    PieChartConfigurable,
    PieChartConfigurableLoading,
} from '@/components/pie-chart-configurable';
import type { ChartWidgetConfig } from '@/lib/widgets/types';

interface ChartWidgetProps {
    config: ChartWidgetConfig;
}

export function ChartWidget({ config }: ChartWidgetProps) {
    const { data, isLoading } = useGetSummary();

    const chartData = config.dataSource === 'tags' ? data?.tags : [];

    if (isLoading) {
        return (
            <PieChartConfigurableLoading
                title={
                    config.dataSource === 'transactions'
                        ? 'Transactions Distribution'
                        : 'Tags Distribution'
                }
            />
        );
    }

    return (
        <PieChartConfigurable
            title={
                config.dataSource === 'transactions'
                    ? 'Transactions Distribution'
                    : 'Tags Distribution'
            }
            data={chartData}
            chartType={config.chartType}
            isLoading={isLoading}
        />
    );
}
