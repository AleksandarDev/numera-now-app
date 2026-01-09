'use client';

import { useEffect, useRef } from 'react';
import {
    useGetDashboardLayout,
    useUpdateDashboardLayout,
} from '@/features/dashboard/api';
import { useDashboardStore } from '@/lib/widgets/store';

/**
 * DashboardSync component handles synchronization between the dashboard store
 * and the database. It loads the layout on mount and saves changes to the database.
 */
export function DashboardSync() {
    const { data: dashboardData, isLoading } = useGetDashboardLayout();
    const { mutate: updateLayout } = useUpdateDashboardLayout();
    const { widgets, setWidgets, isInitialized, setInitialized } =
        useDashboardStore();
    const isFirstLoad = useRef(true);

    // Load initial data from database
    useEffect(() => {
        if (!isLoading && dashboardData && isFirstLoad.current) {
            isFirstLoad.current = false;

            // If user has saved layout, use it; otherwise use default
            if (
                dashboardData.widgets &&
                Array.isArray(dashboardData.widgets) &&
                dashboardData.widgets.length > 0
            ) {
                setWidgets(dashboardData.widgets);
            }

            setInitialized(true);
        }
    }, [isLoading, dashboardData, setWidgets, setInitialized]);

    // Sync changes to database (debounced)
    useEffect(() => {
        if (!isInitialized) {
            return;
        }

        const timeoutId = setTimeout(() => {
            updateLayout({
                widgets,
            });
        }, 1000); // Debounce for 1 second

        return () => clearTimeout(timeoutId);
    }, [widgets, isInitialized, updateLayout]);

    return null;
}
