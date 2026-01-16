import { Suspense } from 'react';
import { DashboardControls } from '@/components/dashboard/dashboard-controls';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { DashboardSync } from '@/components/dashboard/dashboard-sync';
import { EditModeButton } from '@/components/dashboard/edit-mode-button';

export default function DashboardPage() {
    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <DashboardSync />
            <DashboardControls />
            <Suspense>
                <DashboardGrid />
            </Suspense>
            <EditModeButton />
        </div>
    );
}
