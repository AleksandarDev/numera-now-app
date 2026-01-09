'use client';

import { create } from 'zustand';
import { createWidgetInstance } from './registry';
import type { DashboardLayout, WidgetConfig, WidgetType } from './types';

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
 * Default dashboard layout with existing widgets
 */
const defaultLayout: DashboardLayout = {
    widgets: [
        createWidgetInstance('data-grid'),
        createWidgetInstance('data-charts'),
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
            widgets: [...state.widgets, createWidgetInstance(type)],
        })),

    removeWidget: (id) =>
        set((state) => ({
            widgets: state.widgets.filter((widget) => widget.id !== id),
        })),

    updateWidget: (id, config) =>
        set((state) => ({
            widgets: state.widgets.map((widget) =>
                widget.id === id ? { ...widget, ...config } : widget,
            ),
        })),

    reorderWidgets: (newOrder) =>
        set({
            widgets: newOrder,
        }),

    resetToDefault: () =>
        set({
            widgets: [
                createWidgetInstance('data-grid'),
                createWidgetInstance('data-charts'),
            ],
        }),
}));
