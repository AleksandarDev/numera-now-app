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
    explanation?: string;
};

export const ValidationIndicator = ({
    message,
    severity = 'warning',
    explanation,
}: ValidationIndicatorProps) => {
    const colorClass = severity === 'error' ? 'text-red-500' : 'text-amber-500';

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertTriangle
                        className={`size-4 min-w-4 ${colorClass} cursor-help`}
                        data-row-interactive="true"
                    />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                        <p className="font-medium">{message}</p>
                        {explanation && (
                            <p className="text-xs text-muted-foreground">
                                {explanation}
                            </p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
