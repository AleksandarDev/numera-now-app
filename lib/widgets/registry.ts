import { BarChart3, Grid3x3, LineChart, PieChart } from 'lucide-react';
import { ChartWidget } from '@/components/widgets/chart-widget';
import { DataChartsWidget } from '@/components/widgets/data-charts-widget';
import { DataGridWidget } from '@/components/widgets/data-grid-widget';
import { FinancialSummaryWidget } from '@/components/widgets/financial-summary-widget';
import { GraphWidget } from '@/components/widgets/graph-widget';
import type {
    ChartWidgetConfig,
    DataChartsWidgetConfig,
    DataGridWidgetConfig,
    FinancialSummaryWidgetConfig,
    GraphWidgetConfig,
    WidgetConfig,
    WidgetDefinition,
    WidgetType,
} from '@/lib/widgets/types';

/**
 * Registry of all official widgets
 */
const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
    'financial-summary': {
        type: 'financial-summary',
        name: 'Financial Summary',
        description:
            'Displays individual financial summary cards (Balance, Income, or Expenses)',
        icon: Grid3x3,
        component: FinancialSummaryWidget as WidgetDefinition['component'],
        defaultConfig: {
            type: 'financial-summary',
            summaryType: 'balance',
            refreshRate: 60,
        } as Omit<FinancialSummaryWidgetConfig, 'id'>,
        configSchema: {
            fields: [
                {
                    name: 'summaryType',
                    label: 'Summary Type',
                    type: 'select',
                    options: [
                        { label: 'Balance', value: 'balance' },
                        { label: 'Income', value: 'income' },
                        { label: 'Expenses', value: 'expenses' },
                    ],
                    defaultValue: 'balance',
                    description:
                        'Which financial summary to display in this widget',
                },
                {
                    name: 'refreshRate',
                    label: 'Refresh Rate (seconds)',
                    type: 'number',
                    defaultValue: 60,
                    description: 'How often the widget data should refresh',
                },
            ],
        },
    },
    graph: {
        type: 'graph',
        name: 'Graph',
        description:
            'Displays line, area, or bar charts with configurable data source',
        icon: LineChart,
        component: GraphWidget as WidgetDefinition['component'],
        defaultConfig: {
            type: 'graph',
            dataSource: 'transactions',
            chartType: 'area',
            refreshRate: 60,
            colSpan: 2,
        } as Omit<GraphWidgetConfig, 'id'>,
        configSchema: {
            fields: [
                {
                    name: 'dataSource',
                    label: 'Data Source',
                    type: 'select',
                    options: [
                        { label: 'Transactions', value: 'transactions' },
                        { label: 'Tags', value: 'tags' },
                    ],
                    defaultValue: 'transactions',
                    description: 'Which data to visualize',
                },
                {
                    name: 'chartType',
                    label: 'Chart Type',
                    type: 'select',
                    options: [
                        { label: 'Area', value: 'area' },
                        { label: 'Bar', value: 'bar' },
                        { label: 'Line', value: 'line' },
                    ],
                    defaultValue: 'area',
                    description: 'The type of chart to display',
                },
                {
                    name: 'refreshRate',
                    label: 'Refresh Rate (seconds)',
                    type: 'number',
                    defaultValue: 60,
                    description: 'How often the widget data should refresh',
                },
            ],
        },
    },
    chart: {
        type: 'chart',
        name: 'Chart',
        description:
            'Displays pie, radar, or radial charts with configurable data source',
        icon: PieChart,
        component: ChartWidget as WidgetDefinition['component'],
        defaultConfig: {
            type: 'chart',
            dataSource: 'tags',
            chartType: 'pie',
            refreshRate: 60,
            colSpan: 2,
        } as Omit<ChartWidgetConfig, 'id'>,
        configSchema: {
            fields: [
                {
                    name: 'dataSource',
                    label: 'Data Source',
                    type: 'select',
                    options: [
                        { label: 'Transactions', value: 'transactions' },
                        { label: 'Tags', value: 'tags' },
                    ],
                    defaultValue: 'tags',
                    description: 'Which data to visualize',
                },
                {
                    name: 'chartType',
                    label: 'Chart Type',
                    type: 'select',
                    options: [
                        { label: 'Pie', value: 'pie' },
                        { label: 'Radar', value: 'radar' },
                        { label: 'Radial', value: 'radial' },
                    ],
                    defaultValue: 'pie',
                    description: 'The type of chart to display',
                },
                {
                    name: 'refreshRate',
                    label: 'Refresh Rate (seconds)',
                    type: 'number',
                    defaultValue: 60,
                    description: 'How often the widget data should refresh',
                },
            ],
        },
    },
    'data-grid': {
        type: 'data-grid',
        name: 'Financial Summary (Legacy)',
        description:
            'Displays balance, income, and expenses in summary cards (deprecated - use Financial Summary widget instead)',
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
        name: 'Analytics Charts (Legacy)',
        description:
            'Shows line chart and spending pie chart for analytics (deprecated - use Graph and Chart widgets instead)',
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
 * @param type The widget type to look up
 * @returns The widget definition, or undefined if the type is not found
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
