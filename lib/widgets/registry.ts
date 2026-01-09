import { BarChart3, Grid3x3 } from 'lucide-react';
import type {
    WidgetDefinition,
    WidgetType,
    WidgetConfig,
    DataGridWidgetConfig,
    DataChartsWidgetConfig,
} from '@/lib/widgets/types';
import { DataGridWidget } from '@/components/widgets/data-grid-widget';
import { DataChartsWidget } from '@/components/widgets/data-charts-widget';

/**
 * Registry of all official widgets
 */
const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
    'data-grid': {
        type: 'data-grid',
        name: 'Financial Summary',
        description: 'Displays balance, income, and expenses in summary cards',
        icon: Grid3x3,
        component: DataGridWidget as WidgetDefinition['component'],
        defaultConfig: {
            type: 'data-grid',
            refreshRate: 60,
            showBalance: true,
            showIncome: true,
            showExpenses: true,
        } as Omit<DataGridWidgetConfig, 'id'>,
        configSchema: {
            fields: [
                {
                    name: 'refreshRate',
                    label: 'Refresh Rate (seconds)',
                    type: 'number',
                    defaultValue: 60,
                    description: 'How often the widget data should refresh',
                },
                {
                    name: 'showBalance',
                    label: 'Show Balance',
                    type: 'boolean',
                    defaultValue: true,
                },
                {
                    name: 'showIncome',
                    label: 'Show Income',
                    type: 'boolean',
                    defaultValue: true,
                },
                {
                    name: 'showExpenses',
                    label: 'Show Expenses',
                    type: 'boolean',
                    defaultValue: true,
                },
            ],
        },
    },
    'data-charts': {
        type: 'data-charts',
        name: 'Analytics Charts',
        description: 'Shows line chart and spending pie chart for analytics',
        icon: BarChart3,
        component: DataChartsWidget as WidgetDefinition['component'],
        defaultConfig: {
            type: 'data-charts',
            refreshRate: 60,
            defaultChartType: 'area',
            defaultPieType: 'pie',
        } as Omit<DataChartsWidgetConfig, 'id'>,
        configSchema: {
            fields: [
                {
                    name: 'refreshRate',
                    label: 'Refresh Rate (seconds)',
                    type: 'number',
                    defaultValue: 60,
                    description: 'How often the widget data should refresh',
                },
                {
                    name: 'defaultChartType',
                    label: 'Default Chart Type',
                    type: 'select',
                    options: [
                        { label: 'Area', value: 'area' },
                        { label: 'Bar', value: 'bar' },
                        { label: 'Line', value: 'line' },
                    ],
                    defaultValue: 'area',
                },
                {
                    name: 'defaultPieType',
                    label: 'Default Pie Type',
                    type: 'select',
                    options: [
                        { label: 'Pie', value: 'pie' },
                        { label: 'Radar', value: 'radar' },
                        { label: 'Radial', value: 'radial' },
                    ],
                    defaultValue: 'pie',
                },
            ],
        },
    },
};

/**
 * Get all available widget definitions
 */
export function getAvailableWidgets(): WidgetDefinition[] {
    return Object.values(widgetRegistry);
}

/**
 * Get a specific widget definition by type
 */
export function getWidgetDefinition(
    type: WidgetType,
): WidgetDefinition | undefined {
    return widgetRegistry[type];
}

/**
 * Create a new widget instance with default configuration
 */
export function createWidgetInstance(type: WidgetType): WidgetConfig {
    const definition = getWidgetDefinition(type);
    if (!definition) {
        throw new Error(`Unknown widget type: ${type}`);
    }

    return {
        ...definition.defaultConfig,
        id: generateWidgetId(),
    } as WidgetConfig;
}

/**
 * Generate a unique widget ID
 */
function generateWidgetId(): string {
    return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
