'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/lib/widgets/store';
import { WidgetStoreButton } from './widget-store-button';

export function DashboardControls() {
    const { resetToDefault } = useDashboardStore();

    return (
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <WidgetStoreButton />
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
                className="text-muted-foreground"
            >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset Layout
            </Button>
        </div>
    );
}
