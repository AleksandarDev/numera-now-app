'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Loader2, Plus } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useState } from 'react';
import { BankIntegrationCard } from '@/components/bank-integration-card';
import { CountrySelect } from '@/components/country-select';
import { DataTable } from '@/components/data-table';
import { DataTableSearch } from '@/components/data-table-search';
import { DocumentTypesSettingsCard } from '@/components/document-types-settings-card';
import { OpenFinancesSettingsCard } from '@/components/open-finances-settings-card';
import { ReconciliationSettingsCard } from '@/components/reconciliation-settings-card';
import { StripeIntegrationCard } from '@/components/stripe-integration-card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AccountingPeriodsSettingsCard } from '@/features/accounting-periods/components/accounting-periods-settings-card';
import { YearClosingWizard } from '@/features/accounting-periods/components/year-closing-wizard';
import { AuditSettingsSection } from '@/features/audit/components/audit-settings-section';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { useUpdateSettings } from '@/features/settings/api/use-update-settings';
import { useBulkDeleteTags } from '@/features/tags/api/use-bulk-delete-tags';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useNewTag } from '@/features/tags/hooks/use-new-tag';
import { tagColumns } from './tag-columns';

const settingsSectionValues = [
    'general',
    'accounting',
    'automation',
    'integrations',
    'documents',
    'audit',
] as const;

type SettingsSection = (typeof settingsSectionValues)[number];

const settingsSections: Array<{
    value: SettingsSection;
    label: string;
}> = [
    { value: 'general', label: 'General' },
    { value: 'accounting', label: 'Accounting' },
    { value: 'automation', label: 'Automation' },
    { value: 'integrations', label: 'Integrations' },
    { value: 'documents', label: 'Documents' },
    { value: 'audit', label: 'Audit' },
];

const getSettingsSection = (value: string): SettingsSection =>
    settingsSectionValues.includes(value as SettingsSection)
        ? (value as SettingsSection)
        : 'general';

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

function DefaultCustomerCountrySettings() {
    const settingsQuery = useGetSettings();
    const updateSettings = useUpdateSettings();

    const isLoading = settingsQuery.isLoading;
    const defaultCustomerCountry =
        settingsQuery.data?.defaultCustomerCountry ?? null;

    const handleChange = (value: string) => {
        updateSettings.mutate({ defaultCustomerCountry: value || null });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Default Customer Country</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Set the default country for new customers
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                    <div className="flex-1">
                        <Label htmlFor="default-customer-country">
                            Country
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            New customers will be assigned this country by
                            default
                        </p>
                    </div>
                    <CountrySelect
                        value={defaultCustomerCountry}
                        onChange={handleChange}
                        disabled={isLoading || updateSettings.isPending}
                        className="w-[250px]"
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
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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
                <div className="mb-4 flex items-center">
                    <DataTableSearch
                        filterKey="name"
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                    />
                </div>
                <DataTable
                    paginationKey="settingsTags"
                    columns={tagColumns}
                    data={tags}
                    onDelete={(row) => {
                        const ids = row.map((r) => r.original.id);
                        deleteTags.mutate({ ids });
                    }}
                    disabled={isDisabled}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                />
            </CardContent>
        </Card>
    );
}

function SettingsSections() {
    const [sectionParam, setSectionParam] = useQueryState(
        'section',
        parseAsString.withDefault('general'),
    );
    const selectedSection = getSettingsSection(sectionParam);

    const handleSectionChange = (value: string) => {
        const nextSection = getSettingsSection(value);
        void setSectionParam(nextSection === 'general' ? null : nextSection);
    };

    return (
        <Tabs
            value={selectedSection}
            onValueChange={handleSectionChange}
            className="space-y-4"
        >
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 lg:inline-flex lg:w-auto">
                {settingsSections.map((section) => (
                    <TabsTrigger
                        key={section.value}
                        value={section.value}
                        className="w-full lg:w-auto"
                    >
                        {section.label}
                    </TabsTrigger>
                ))}
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-4">
                <DefaultCustomerCountrySettings />
                <TagsSection />
            </TabsContent>
            <TabsContent value="accounting" className="mt-0 space-y-4">
                <DoubleEntrySettings />
                <AccountingPeriodsSettingsCard />
            </TabsContent>
            <TabsContent value="automation" className="mt-0 space-y-4">
                <TransactionStatusAutomationSettings />
                <ReconciliationSettingsCard />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0 space-y-4">
                <StripeIntegrationCard />
                <BankIntegrationCard />
                <OpenFinancesSettingsCard />
            </TabsContent>
            <TabsContent value="documents" className="mt-0 space-y-4">
                <DocumentTypesSettingsCard />
            </TabsContent>
            <TabsContent value="audit" className="mt-0">
                <AuditSettingsSection />
            </TabsContent>
        </Tabs>
    );
}

export default function SettingsPage() {
    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Suspense
                fallback={
                    <div className="flex h-[500px] w-full items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-slate-300" />
                    </div>
                }
            >
                <SettingsSections />
            </Suspense>
            <YearClosingWizard />
        </div>
    );
}
