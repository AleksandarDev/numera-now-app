'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Loader2 } from 'lucide-react';

export type QuickAssignSuggestion = {
    id: string;
    label: string;
};

type QuickAssignSuggestionsProps = {
    suggestions: QuickAssignSuggestion[];
    isLoading: boolean;
    onSelect: (id: string) => void;
    disabled?: boolean;
    /** Label shown before suggestions, defaults to "Suggested:" */
    label?: string;
};

export const QuickAssignSuggestions = ({
    suggestions,
    isLoading,
    onSelect,
    disabled,
    label = 'Suggested:',
}: QuickAssignSuggestionsProps) => {
    if (!isLoading && suggestions.length === 0) {
        return null;
    }

    const handleSelect = (id: string) => {
        if (disabled) return;
        onSelect(id);
    };

    return (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {isLoading ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    Loading suggestions...
                </span>
            ) : (
                <>
                    <span className="text-xs text-muted-foreground">
                        {label}
                    </span>
                    {suggestions.map((suggestion) => (
                        <Button
                            key={suggestion.id}
                            type="button"
                            variant="outlined"
                            size="sm"
                            className="h-6 px-2 text-xs truncate max-w-24 justify-start cursor-pointer"
                            disabled={disabled}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleSelect(suggestion.id);
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key !== 'Enter' &&
                                    event.key !== ' '
                                ) {
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                handleSelect(suggestion.id);
                            }}
                        >
                            {suggestion.label}
                        </Button>
                    ))}
                </>
            )}
        </div>
    );
};
