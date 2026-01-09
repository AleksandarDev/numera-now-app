import type { ComponentType } from 'react';

/**
 * Widget types supported in the dashboard
 */
export type WidgetType = 'data-grid' | 'data-charts';

/**
 * Base configuration that all widgets share
 */
export interface BaseWidgetConfig {
    id: string;
    type: WidgetType;
    title?: string;
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
 * Union type of all widget configurations
 */
export type WidgetConfig = DataGridWidgetConfig | DataChartsWidgetConfig;

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
    type: 'text' | 'number' | 'boolean' | 'select';
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
