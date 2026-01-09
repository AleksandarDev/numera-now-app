'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getWidgetDefinition } from '@/lib/widgets/registry';
import { useDashboardStore } from '@/lib/widgets/store';
import type { WidgetConfig } from '@/lib/widgets/types';

interface WidgetConfigDialogProps {
    widget: WidgetConfig;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WidgetConfigDialog({
    widget,
    open,
    onOpenChange,
}: WidgetConfigDialogProps) {
    const { updateWidget } = useDashboardStore();
    const definition = getWidgetDefinition(widget.type);
    const [config, setConfig] = useState(widget);

    if (!definition || !definition.configSchema) {
        return null;
    }

    const handleSave = () => {
        updateWidget(widget.id, config);
        onOpenChange(false);
    };

    const handleFieldChange = (name: string, value: unknown) => {
        setConfig((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const getConfigValue = (
        name: string,
    ): string | number | boolean | undefined => {
        // Type-safe way to access config values
        const configRecord = config as unknown as Record<
            string,
            string | number | boolean | undefined
        >;
        return configRecord[name] ?? undefined;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Configure {definition.name}</DialogTitle>
                    <DialogDescription>
                        {definition.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {definition.configSchema.fields.map((field) => {
                        const value = getConfigValue(field.name);

                        return (
                            <div key={field.name} className="grid gap-2">
                                <Label htmlFor={field.name}>
                                    {field.label}
                                </Label>

                                {field.type === 'text' && (
                                    <Input
                                        id={field.name}
                                        type="text"
                                        value={
                                            (value as string) ??
                                            field.defaultValue ??
                                            ''
                                        }
                                        onChange={(e) =>
                                            handleFieldChange(
                                                field.name,
                                                e.target.value,
                                            )
                                        }
                                    />
                                )}

                                {field.type === 'number' && (
                                    <Input
                                        id={field.name}
                                        type="number"
                                        value={
                                            (value as number) ??
                                            field.defaultValue ??
                                            0
                                        }
                                        onChange={(e) => {
                                            const numValue = Number.parseFloat(
                                                e.target.value,
                                            );
                                            handleFieldChange(
                                                field.name,
                                                Number.isNaN(numValue)
                                                    ? 0
                                                    : numValue,
                                            );
                                        }}
                                    />
                                )}

                                {field.type === 'boolean' && (
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={field.name}
                                            checked={
                                                (value as boolean) ??
                                                field.defaultValue ??
                                                false
                                            }
                                            onCheckedChange={(checked) =>
                                                handleFieldChange(
                                                    field.name,
                                                    checked,
                                                )
                                            }
                                        />
                                    </div>
                                )}

                                {field.type === 'select' && field.options && (
                                    <Select
                                        value={String(
                                            value ?? field.defaultValue ?? '',
                                        )}
                                        onValueChange={(val) =>
                                            handleFieldChange(field.name, val)
                                        }
                                    >
                                        <SelectTrigger id={field.name}>
                                            <SelectValue placeholder="Select an option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options.map((option) => (
                                                <SelectItem
                                                    key={String(option.value)}
                                                    value={String(option.value)}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {field.description && (
                                    <p className="text-xs text-muted-foreground">
                                        {field.description}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
