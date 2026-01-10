'use client';

import { create } from 'zustand';
import { createWidgetInstance } from './registry';
import type {
    DashboardLayout,
    WidgetConfig,
    WidgetType,
    FinancialSummaryWidgetConfig,
    GraphWidgetConfig,
    ChartWidgetConfig,
} from './types';

interface DashboardStore extends DashboardLayout {
    addWidget: (type: WidgetType) => void;
    removeWidget: (id: string) => void;
    updateWidget: (id: string, config: Partial<WidgetConfig>) => void;
    reorderWidgets: (newOrder: WidgetConfig[]) => void;
    resetToDefault: () => void;
    setWidgets: (widgets: WidgetConfig[]) => void;
    isInitialized: boolean;
    setInitialized: (initialized: boolean) => void;
}

/**
 * Helper function to generate a unique widget ID
 */
function generateWidgetId(): string {
    return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Default dashboard layout with new modular widgets
 */
const defaultLayout: DashboardLayout = {
    widgets: [
        // Financial Summary Cards - one for each type
        {
            id: generateWidgetId(),
            type: 'financial-summary',
            refreshRate: 60,
            summaryType: 'balance',
        } as FinancialSummaryWidgetConfig,
        {
            id: generateWidgetId(),
            type: 'financial-summary',
            refreshRate: 60,
            summaryType: 'income',
        } as FinancialSummaryWidgetConfig,
        {
            id: generateWidgetId(),
            type: 'financial-summary',
            refreshRate: 60,
            summaryType: 'expenses',
        } as FinancialSummaryWidgetConfig,
        // Graph Widget - for line/area/bar charts
        {
            id: generateWidgetId(),
            type: 'graph',
            refreshRate: 60,
            dataSource: 'transactions',
            chartType: 'area',
        } as GraphWidgetConfig,
        // Chart Widget - for pie/radar/radial charts
        {
            id: generateWidgetId(),
            type: 'chart',
            refreshRate: 60,
            dataSource: 'tags',
            chartType: 'pie',
        } as ChartWidgetConfig,
    ],
};

/**
 * Dashboard store for managing widget layout and configuration
 * Note: This store no longer uses localStorage. State is synced with the database
 * via the DashboardSync component.
 */
export const useDashboardStore = create<DashboardStore>()((set) => ({
    widgets: defaultLayout.widgets,
    isInitialized: false,

    setWidgets: (widgets) =>
        set({
            widgets,
        }),

    setInitialized: (initialized) =>
        set({
            isInitialized: initialized,
        }),

    addWidget: (type) =>
        set((state) => ({
            widgets: [...state.widgets, createWidgetInstance(type)] as WidgetConfig[],
        })),

    removeWidget: (id) =>
        set((state) => ({
            widgets: state.widgets.filter((widget) => widget.id !== id),
        })),

    updateWidget: (id, config) =>
        set((state) => ({
            widgets: state.widgets.map((widget) =>
                widget.id === id ? { ...widget, ...config } : widget,
            ) as WidgetConfig[],
        })),

    reorderWidgets: (newOrder) =>
        set({
            widgets: newOrder,
        }),

    resetToDefault: () =>
        set({
            widgets: [
                {
                    id: generateWidgetId(),
                    type: 'financial-summary',
                    refreshRate: 60,
                    summaryType: 'balance',
                } as FinancialSummaryWidgetConfig,
                {
                    id: generateWidgetId(),
                    type: 'financial-summary',
                    refreshRate: 60,
                    summaryType: 'income',
                } as FinancialSummaryWidgetConfig,
                {
                    id: generateWidgetId(),
                    type: 'financial-summary',
                    refreshRate: 60,
                    summaryType: 'expenses',
                } as FinancialSummaryWidgetConfig,
                {
                    id: generateWidgetId(),
                    type: 'graph',
                    refreshRate: 60,
                    dataSource: 'transactions',
                    chartType: 'area',
                } as GraphWidgetConfig,
                {
                    id: generateWidgetId(),
                    type: 'chart',
                    refreshRate: 60,
                    dataSource: 'tags',
                    chartType: 'pie',
                } as ChartWidgetConfig,
            ],
        }),
}));
