import { Suspense } from 'react';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { DashboardControls } from '@/components/dashboard/dashboard-controls';

export default function DashboardPage() {
    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <DashboardControls />
            <Suspense>
                <DashboardGrid />
            </Suspense>
        </div>
    );
}
