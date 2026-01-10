'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { WidgetConfig } from '@/lib/widgets/types';
import { DraggableWidget } from './draggable-widget';

interface LegacyWidgetsAccordionProps {
    widgets: WidgetConfig[];
}

export function LegacyWidgetsAccordion({
    widgets,
}: LegacyWidgetsAccordionProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (widgets.length === 0) {
        return null;
    }

    return (
        <div className="border-l-4 border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 mb-8">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
            >
                <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Legacy Widgets ({widgets.length})
                    </div>
                    <div className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 px-2 py-1 rounded-full">
                        Deprecated
                    </div>
                </div>
                <ChevronDown
                    className={`h-5 w-5 text-amber-700 dark:text-amber-300 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="mt-4 space-y-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                        These widgets are deprecated. Please migrate to the new
                        modular widgets:
                    </p>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 mb-4 ml-2">
                        <li>
                            • "Financial Summary" → Use individual "Financial
                            Summary" widgets
                        </li>
                        <li>
                            • "Analytics Charts" → Use "Graph" and "Chart"
                            widgets
                        </li>
                    </ul>
                    <div className="space-y-4">
                        {widgets.map((widget) => (
                            <DraggableWidget
                                key={widget.id}
                                widget={widget}
                                isLegacy={true}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
