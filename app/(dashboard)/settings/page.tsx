'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Loader2, Plus } from 'lucide-react';
import { Suspense } from 'react';
import { DataTable } from '@/components/data-table';
import { DocumentTypesSettingsCard } from '@/components/document-types-settings-card';
import { ReconciliationSettingsCard } from '@/components/reconciliation-settings-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBulkDeleteCategories } from '@/features/categories/api/use-bulk-delete-categories';
import { useGetCategories } from '@/features/categories/api/use-get-categories';
import { useNewCategory } from '@/features/categories/hooks/use-new-category';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { useUpdateSettings } from '@/features/settings/api/use-update-settings';
import { columns } from '../categories/columns';

function DoubleEntrySettings() {
    const settingsQuery = useGetSettings();
    const updateSettings = useUpdateSettings();

    const isLoading = settingsQuery.isLoading;
    const doubleEntryMode = settingsQuery.data?.doubleEntryMode ?? false;

    const handleToggle = (checked: boolean) => {
        updateSettings.mutate({ doubleEntryMode: checked });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Accounting Mode</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Configure how transactions are recorded in your system
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                    <div className="flex-1">
                        <Label htmlFor="double-entry-mode">
                            Double-Entry Bookkeeping
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            When enabled, all transactions must have both credit
                            and debit accounts
                        </p>
                    </div>
                    <Switch
                        id="double-entry-mode"
                        checked={doubleEntryMode}
                        onCheckedChange={handleToggle}
                        disabled={isLoading || updateSettings.isPending}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function CategoriesSection() {
    const newCategory = useNewCategory();
    const deleteCategories = useBulkDeleteCategories();
    const categoriesQuery = useGetCategories();
    const categories = categoriesQuery.data || [];

    const isDisabled = categoriesQuery.isLoading || deleteCategories.isPending;

    return (
        <Card>
            <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>Categories</CardTitle>
                <Button onClick={newCategory.onOpen} size="sm">
                    <Plus className="size-4 mr-2" />
                    Add new
                </Button>
            </CardHeader>
            <CardContent>
                <DataTable
                    filterKey="name"
                    columns={columns}
                    data={categories}
                    onDelete={(row) => {
                        const ids = row.map((r) => r.original.id);
                        deleteCategories.mutate({ ids });
                    }}
                    disabled={isDisabled}
                />
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10 space-y-4">
            <Suspense
                fallback={
                    <div className="flex h-[500px] w-full items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-slate-300" />
                    </div>
                }
            >
                <DoubleEntrySettings />
                <DocumentTypesSettingsCard />
                <ReconciliationSettingsCard />
                <CategoriesSection />
            </Suspense>
        </div>
    );
}
