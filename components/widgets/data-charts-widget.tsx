'use client';

import { DataCharts } from '@/components/data-charts';
import type { DataChartsWidgetConfig } from '@/lib/widgets/types';

interface DataChartsWidgetProps {
    config: DataChartsWidgetConfig;
}

export function DataChartsWidget({ config: _config }: DataChartsWidgetProps) {
    // For now, pass through to the existing DataCharts component
    // In the future, config options like defaultChartType and defaultPieType
    // can be passed to the component to set initial state
    return <DataCharts />;
}
