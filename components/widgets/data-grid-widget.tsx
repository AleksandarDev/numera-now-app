'use client';

import { DataGrid } from '@/components/data-grid';
import type { DataGridWidgetConfig } from '@/lib/widgets/types';

interface DataGridWidgetProps {
    config: DataGridWidgetConfig;
}

export function DataGridWidget({ config }: DataGridWidgetProps) {
    // For now, pass through to the existing DataGrid component
    // In the future, config options like showBalance, showIncome, showExpenses
    // can be used to filter the cards displayed
    return <DataGrid />;
}
