'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAvailableWidgets } from '@/lib/widgets/registry';
import { useDashboardStore } from '@/lib/widgets/store';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export function WidgetStoreButton() {
    const [open, setOpen] = useState(false);
    const { addWidget } = useDashboardStore();
    const availableWidgets = getAvailableWidgets();

    const handleAddWidget = (type: Parameters<typeof addWidget>[0]) => {
        addWidget(type);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Widget
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Widget Store</DialogTitle>
                    <DialogDescription>
                        Add official widgets to your dashboard
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {availableWidgets.map((widget) => {
                        const IconComponent = widget.icon;
                        return (
                            <Card
                                key={widget.type}
                                className="cursor-pointer transition-colors hover:bg-accent"
                                onClick={() => handleAddWidget(widget.type)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <IconComponent className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-base">
                                                {widget.name}
                                            </CardTitle>
                                        </div>
                                        <Button size="sm" variant="outline">
                                            Add
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-3">
                                    <CardDescription>
                                        {widget.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
