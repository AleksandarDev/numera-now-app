'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { RefreshCcw } from 'lucide-react';
import { useDashboardStore } from '@/lib/widgets/store';
import { WidgetStoreButton } from './widget-store-button';

export function DashboardControls() {
    const { resetToDefault } = useDashboardStore();

    return (
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <WidgetStoreButton />
            </div>
            <Button variant="plain" onClick={resetToDefault} className="text-white/70">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset Layout
            </Button>
        </div>
    );
}
