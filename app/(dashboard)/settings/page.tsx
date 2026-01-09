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
import { StripeIntegrationCard } from '@/components/stripe-integration-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { useUpdateSettings } from '@/features/settings/api/use-update-settings';
import { useBulkDeleteTags } from '@/features/tags/api/use-bulk-delete-tags';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useNewTag } from '@/features/tags/hooks/use-new-tag';
import { tagColumns } from './tag-columns';

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

function TransactionStatusAutomationSettings() {
    const settingsQuery = useGetSettings();
    const updateSettings = useUpdateSettings();

    const isLoading = settingsQuery.isLoading;
    const autoDraftToPending = settingsQuery.data?.autoDraftToPending ?? false;

    const handleToggle = (checked: boolean) => {
        updateSettings.mutate({ autoDraftToPending: checked });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction Status</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Configure automatic status changes
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                    <div className="flex-1">
                        <Label htmlFor="auto-draft-to-pending">
                            Auto Draft &gt; Pending
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            When enabled, a draft transaction will automatically
                            move to Pending once required fields are filled and
                            validation passes.
                        </p>
                    </div>
                    <Switch
                        id="auto-draft-to-pending"
                        checked={autoDraftToPending}
                        onCheckedChange={handleToggle}
                        disabled={isLoading || updateSettings.isPending}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function TagsSection() {
    const newTag = useNewTag();
    const deleteTags = useBulkDeleteTags();
    const tagsQuery = useGetTags();
    const tags = tagsQuery.data || [];

    const isDisabled = tagsQuery.isLoading || deleteTags.isPending;

    return (
        <Card>
            <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>Tags</CardTitle>
                <Button onClick={newTag.onOpen} size="sm">
                    <Plus className="size-4 mr-2" />
                    Add new
                </Button>
            </CardHeader>
            <CardContent>
                <DataTable
                    filterKey="name"
                    paginationKey="settingsTags"
                    columns={tagColumns}
                    data={tags}
                    onDelete={(row) => {
                        const ids = row.map((r) => r.original.id);
                        deleteTags.mutate({ ids });
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
                <TransactionStatusAutomationSettings />
                <StripeIntegrationCard />
                <DocumentTypesSettingsCard />
                <ReconciliationSettingsCard />
                <TagsSection />
            </Suspense>
        </div>
    );
}
