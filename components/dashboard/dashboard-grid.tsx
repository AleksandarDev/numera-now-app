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
import { DraggableWidget } from './draggable-widget';

export function DashboardGrid() {
    const { widgets, reorderWidgets } = useDashboardStore();

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

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={widgets.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-8">
                    {widgets.map((widget) => (
                        <DraggableWidget key={widget.id} widget={widget} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
