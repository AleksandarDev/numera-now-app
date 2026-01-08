'use client';

import { AlertTriangle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

type ValidationIndicatorProps = {
    message: string;
    severity?: 'warning' | 'error';
};

export const ValidationIndicator = ({
    message,
    severity = 'warning',
}: ValidationIndicatorProps) => {
    const colorClass = severity === 'error' ? 'text-red-500' : 'text-amber-500';

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertTriangle
                        className={`size-4 min-w-4 ${colorClass} cursor-help`}
                    />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p>{message}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
