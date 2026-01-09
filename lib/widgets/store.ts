'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardLayout, WidgetConfig, WidgetType } from './types';
import { createWidgetInstance } from './registry';

interface DashboardStore extends DashboardLayout {
    addWidget: (type: WidgetType) => void;
    removeWidget: (id: string) => void;
    updateWidget: (id: string, config: Partial<WidgetConfig>) => void;
    reorderWidgets: (newOrder: WidgetConfig[]) => void;
    resetToDefault: () => void;
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
 */
export const useDashboardStore = create<DashboardStore>()(
    persist(
        (set) => ({
            widgets: defaultLayout.widgets,

            addWidget: (type) =>
                set((state) => ({
                    widgets: [...state.widgets, createWidgetInstance(type)],
                })),

            removeWidget: (id) =>
                set((state) => ({
                    widgets: state.widgets.filter(
                        (widget) => widget.id !== id,
                    ),
                })),

            updateWidget: (id, config) =>
                set((state) => ({
                    widgets: state.widgets.map((widget) =>
                        widget.id === id
                            ? { ...widget, ...config }
                            : widget,
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
        }),
        {
            name: 'dashboard-layout',
        },
    ),
);
