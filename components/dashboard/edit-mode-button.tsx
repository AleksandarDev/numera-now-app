'use client';

import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Check, Pencil } from 'lucide-react';
import { useDashboardStore } from '@/lib/widgets/store';

export function EditModeButton() {
    const { isEditMode, toggleEditMode } = useDashboardStore();

    return (
        <IconButton
            onClick={toggleEditMode}
            size='lg'
            className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
            aria-label={isEditMode ? 'Exit edit mode' : 'Enter edit mode'}
            title={isEditMode ? 'Exit edit mode' : 'Edit dashboard'}
        >
            {isEditMode ? (
                <Check className="size-6 shrink-0" />
            ) : (
                <Pencil className="size-6 shrink-0" />
            )}
        </IconButton>
    );
}
