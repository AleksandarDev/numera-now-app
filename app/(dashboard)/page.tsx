import { Suspense } from 'react';
import { DataCharts } from '@/components/data-charts';
import { DataGrid } from '@/components/data-grid';

export default function DashboardPage() {
    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <Suspense>
                <DataGrid />
            </Suspense>
            <Suspense>
                <DataCharts />
            </Suspense>
        </div>
    );
}
