'use client';

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboardStore } from '@/lib/widgets/store';
import type { WidgetConfig } from '@/lib/widgets/types';
import { DraggableWidget } from './draggable-widget';
import { LegacyWidgetsAccordion } from './legacy-widgets-accordion';
import { MigrationIndicator } from './migration-indicator';

export function DashboardGrid() {
    const { widgets, reorderWidgets } = useDashboardStore();

    // Separate legacy and new widgets
    const legacyWidgets = widgets.filter(
        (w) => w.type === 'data-grid' || w.type === 'data-charts',
    );
    const newWidgets = widgets.filter(
        (w) => w.type !== 'data-grid' && w.type !== 'data-charts',
    );
    const hasLegacyWidgets = legacyWidgets.length > 0;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex(
                (widget) => widget.id === active.id,
            );
            const newIndex = widgets.findIndex(
                (widget) => widget.id === over.id,
            );

            const newOrder = arrayMove(widgets, oldIndex, newIndex);
            reorderWidgets(newOrder);
        }
    }

    const getColSpan = (widget: WidgetConfig): number => {
        return widget.colSpan || 1;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            {/* Migration indicator - shown if legacy widgets present */}
            {hasLegacyWidgets && <MigrationIndicator />}

            {/* New widgets in grid layout */}
            <SortableContext
                items={newWidgets.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {newWidgets.map((widget) => {
                        const colSpan = getColSpan(widget);
                        const gridColSpanClasses =
                            {
                                1: '',
                                2: 'md:col-span-2 lg:col-span-2',
                                3: 'md:col-span-2 lg:col-span-3',
                                4: 'md:col-span-2 lg:col-span-4',
                            }[colSpan] || '';

                        return (
                            <div
                                key={widget.id}
                                className={`col-span-1 ${gridColSpanClasses}`}
                            >
                                <DraggableWidget widget={widget} />
                            </div>
                        );
                    })}
                </div>
            </SortableContext>

            {/* Legacy widgets in accordion */}
            {hasLegacyWidgets && (
                <SortableContext
                    items={legacyWidgets.map((w) => w.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <LegacyWidgetsAccordion widgets={legacyWidgets} />
                </SortableContext>
            )}
        </DndContext>
    );
}
