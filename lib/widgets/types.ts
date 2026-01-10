import type { ComponentType } from 'react';

/**
 * Widget types supported in the dashboard
 */
export type WidgetType =
    | 'financial-summary'
    | 'graph'
    | 'chart'
    | 'data-grid'
    | 'data-charts';

/**
 * Base configuration that all widgets share
 */
export interface BaseWidgetConfig {
    id: string;
    type: WidgetType;
    title?: string;
    // Grid layout options (1-4 columns on desktop)
    colSpan?: number; // 1-4, defaults to 1
    isCollapsed?: boolean; // For accordion/collapse
}

/**
 * Configuration for DataGrid widget
 */
export interface DataGridWidgetConfig extends BaseWidgetConfig {
    type: 'data-grid';
    refreshRate?: number; // in seconds
    showBalance?: boolean;
    showIncome?: boolean;
    showExpenses?: boolean;
}

/**
 * Configuration for DataCharts widget
 */
export interface DataChartsWidgetConfig extends BaseWidgetConfig {
    type: 'data-charts';
    refreshRate?: number; // in seconds
    defaultChartType?: 'area' | 'bar' | 'line';
    defaultPieType?: 'pie' | 'radar' | 'radial';
}

/**
 * Configuration for Financial Summary widget
 */
export interface FinancialSummaryWidgetConfig extends BaseWidgetConfig {
    type: 'financial-summary';
    refreshRate?: number; // in seconds
    summaryType: 'balance' | 'income' | 'expenses'; // Which summary card to display
    accountId?: string; // Optional account filter - if not set, shows total
}

/**
 * Configuration for Graph widget (line, area, bar charts)
 */
export interface GraphWidgetConfig extends BaseWidgetConfig {
    type: 'graph';
    refreshRate?: number; // in seconds
    dataSource: 'transactions' | 'tags'; // transactions for daily data, tags for category data
    chartType: 'area' | 'bar' | 'line'; // Chart type is now defined in config
    accumulation?: 'none' | 'week' | 'month'; // Accumulation period
}

/**
 * Configuration for Chart widget (pie, radar, radial charts)
 */
export interface ChartWidgetConfig extends BaseWidgetConfig {
    type: 'chart';
    refreshRate?: number; // in seconds
    dataSource: 'transactions' | 'tags'; // Which data to visualize
    chartType: 'pie' | 'radar' | 'radial'; // Chart type is now defined in config
}

/**
 * Union type of all widget configurations
 */
export type WidgetConfig =
    | DataGridWidgetConfig
    | DataChartsWidgetConfig
    | FinancialSummaryWidgetConfig
    | GraphWidgetConfig
    | ChartWidgetConfig;

/**
 * Widget definition in the registry
 */
export interface WidgetDefinition<T extends WidgetConfig = WidgetConfig> {
    type: WidgetType;
    name: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    component: ComponentType<{ config: WidgetConfig }>;
    defaultConfig: Omit<T, 'id'>;
    configSchema?: {
        fields: WidgetConfigField[];
    };
}

/**
 * Configuration field definition for widget settings
 */
export interface WidgetConfigField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'account';
    options?: { label: string; value: string | number | boolean }[];
    defaultValue?: string | number | boolean;
    description?: string;
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
    widgets: WidgetConfig[];
}
