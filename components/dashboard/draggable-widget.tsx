'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getWidgetDefinition } from '@/lib/widgets/registry';
import { useDashboardStore } from '@/lib/widgets/store';
import type { WidgetConfig } from '@/lib/widgets/types';
import { WidgetConfigDialog } from './widget-config-dialog';

interface DraggableWidgetProps {
    widget: WidgetConfig;
    isLegacy?: boolean;
}

export function DraggableWidget({ widget, isLegacy }: DraggableWidgetProps) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const { removeWidget, isEditMode } = useDashboardStore();
    const definition = getWidgetDefinition(widget.type);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: widget.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (!definition) {
        return null;
    }

    const WidgetComponent = definition.component;

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                className={cn(
                    'relative group',
                    isDragging && 'opacity-50 z-50',
                    isLegacy && 'opacity-75',
                )}
            >
                {/* Widget Control Bar - only shown in edit mode */}
                {isEditMode && (
                    <div className="absolute -top-10 left-0 right-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-background/80 backdrop-blur-sm border border-border shadow-sm px-2 py-1">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-grab active:cursor-grabbing text-foreground"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical className="h-4 w-4" />
                            <span className="ml-2 text-xs text-foreground">
                                {definition.name}
                            </span>
                            {isLegacy && (
                                <span className="ml-2 text-xs bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                                    Deprecated
                                </span>
                            )}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-foreground"
                            onClick={() => setIsConfigOpen(true)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => removeWidget(widget.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    </div>
                )}

                {/* Widget Content */}
                <div className={isEditMode ? "pt-2" : ""}>
                    <WidgetComponent config={widget} />
                </div>
            </div>

            <WidgetConfigDialog
                widget={widget}
                open={isConfigOpen}
                onOpenChange={setIsConfigOpen}
            />
        </>
    );
}
