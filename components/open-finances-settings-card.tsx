'use client';

import { useAuth } from '@clerk/nextjs';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGetOpenFinancesSettings } from '@/features/open-finances/api/use-get-open-finances-settings';
import { useUpdateOpenFinancesSettings } from '@/features/open-finances/api/use-update-open-finances-settings';

type MetricConfig = {
    enabled: boolean;
    label: string;
    value?: string;
};

type ExposedMetrics = {
    revenue?: MetricConfig;
    expenses?: MetricConfig;
    profit?: MetricConfig;
    balance?: MetricConfig;
};

export function OpenFinancesSettingsCard() {
    const { userId } = useAuth();
    const { data: settings, isLoading } = useGetOpenFinancesSettings();
    const updateSettings = useUpdateOpenFinancesSettings();

    const [copied, setCopied] = useState(false);

    // Parse exposed metrics
    const exposedMetrics: ExposedMetrics = settings?.exposedMetrics
        ? JSON.parse(settings.exposedMetrics)
        : {};

    const isEnabled = settings?.isEnabled ?? false;
    const pageTitle = settings?.pageTitle ?? '';
    const pageDescription = settings?.pageDescription ?? '';
    const allowEmbedding = settings?.allowEmbedding ?? true;

    const handleToggleEnabled = (checked: boolean) => {
        updateSettings.mutate({ isEnabled: checked });
    };

    const handleToggleEmbedding = (checked: boolean) => {
        updateSettings.mutate({ allowEmbedding: checked });
    };

    const handleToggleMetric = (metric: keyof ExposedMetrics) => {
        const newMetrics = {
            ...exposedMetrics,
            [metric]: {
                enabled: !exposedMetrics[metric]?.enabled,
                label:
                    exposedMetrics[metric]?.label ||
                    metric.charAt(0).toUpperCase() + metric.slice(1),
                value: exposedMetrics[metric]?.value || '',
            },
        };
        updateSettings.mutate({
            exposedMetrics: JSON.stringify(newMetrics),
        });
    };

    const handleUpdateMetricValue = (
        metric: keyof ExposedMetrics,
        value: string,
    ) => {
        const newMetrics = {
            ...exposedMetrics,
            [metric]: {
                ...exposedMetrics[metric],
                enabled: exposedMetrics[metric]?.enabled ?? true,
                label:
                    exposedMetrics[metric]?.label ||
                    metric.charAt(0).toUpperCase() + metric.slice(1),
                value: value,
            },
        };
        updateSettings.mutate({
            exposedMetrics: JSON.stringify(newMetrics),
        });
    };

    const embedUrl = userId
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/open-finances/${userId}`
        : '';
    const embedCode = embedUrl
        ? `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`
        : '';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Open Finances</CardTitle>
                    <CardDescription>Loading...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Open Finances</CardTitle>
                <CardDescription>
                    Share selected financial data publicly with transparency.
                    Control what information is visible and how it's displayed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between space-x-2">
                    <div className="flex-1">
                        <Label htmlFor="open-finances-enabled">
                            Enable Open Finances
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Make your financial transparency page publicly
                            accessible
                        </p>
                    </div>
                    <Switch
                        id="open-finances-enabled"
                        checked={isEnabled}
                        onCheckedChange={handleToggleEnabled}
                        disabled={updateSettings.isPending}
                    />
                </div>

                {isEnabled && (
                    <>
                        {/* Page Information */}
                        <div className="space-y-3">
                            <Label>Page Information</Label>
                            <div className="space-y-2">
                                <Input
                                    placeholder="e.g., Our Financial Transparency"
                                    value={pageTitle}
                                    onChange={(e) => {
                                        updateSettings.mutate({
                                            pageTitle: e.target.value,
                                        });
                                    }}
                                />
                                <Textarea
                                    placeholder="Optional description for your transparency page"
                                    value={pageDescription}
                                    onChange={(e) => {
                                        updateSettings.mutate({
                                            pageDescription: e.target.value,
                                        });
                                    }}
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Metrics Configuration */}
                        <div className="space-y-3">
                            <Label>Exposed Metrics</Label>
                            <p className="text-xs text-muted-foreground">
                                Select which financial metrics to share publicly
                                and set their values
                            </p>

                            {/* Revenue */}
                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="metric-revenue">
                                        Revenue
                                    </Label>
                                    <Switch
                                        id="metric-revenue"
                                        checked={
                                            exposedMetrics.revenue?.enabled ??
                                            false
                                        }
                                        onCheckedChange={() =>
                                            handleToggleMetric('revenue')
                                        }
                                        disabled={updateSettings.isPending}
                                    />
                                </div>
                                {exposedMetrics.revenue?.enabled && (
                                    <Input
                                        placeholder="e.g., $100,000"
                                        value={
                                            exposedMetrics.revenue?.value ?? ''
                                        }
                                        onChange={(e) =>
                                            handleUpdateMetricValue(
                                                'revenue',
                                                e.target.value,
                                            )
                                        }
                                    />
                                )}
                            </div>

                            {/* Expenses */}
                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="metric-expenses">
                                        Expenses
                                    </Label>
                                    <Switch
                                        id="metric-expenses"
                                        checked={
                                            exposedMetrics.expenses?.enabled ??
                                            false
                                        }
                                        onCheckedChange={() =>
                                            handleToggleMetric('expenses')
                                        }
                                        disabled={updateSettings.isPending}
                                    />
                                </div>
                                {exposedMetrics.expenses?.enabled && (
                                    <Input
                                        placeholder="e.g., $60,000"
                                        value={
                                            exposedMetrics.expenses?.value ?? ''
                                        }
                                        onChange={(e) =>
                                            handleUpdateMetricValue(
                                                'expenses',
                                                e.target.value,
                                            )
                                        }
                                    />
                                )}
                            </div>

                            {/* Profit */}
                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="metric-profit">
                                        Profit
                                    </Label>
                                    <Switch
                                        id="metric-profit"
                                        checked={
                                            exposedMetrics.profit?.enabled ??
                                            false
                                        }
                                        onCheckedChange={() =>
                                            handleToggleMetric('profit')
                                        }
                                        disabled={updateSettings.isPending}
                                    />
                                </div>
                                {exposedMetrics.profit?.enabled && (
                                    <Input
                                        placeholder="e.g., $40,000"
                                        value={
                                            exposedMetrics.profit?.value ?? ''
                                        }
                                        onChange={(e) =>
                                            handleUpdateMetricValue(
                                                'profit',
                                                e.target.value,
                                            )
                                        }
                                    />
                                )}
                            </div>

                            {/* Balance */}
                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="metric-balance">
                                        Balance
                                    </Label>
                                    <Switch
                                        id="metric-balance"
                                        checked={
                                            exposedMetrics.balance?.enabled ??
                                            false
                                        }
                                        onCheckedChange={() =>
                                            handleToggleMetric('balance')
                                        }
                                        disabled={updateSettings.isPending}
                                    />
                                </div>
                                {exposedMetrics.balance?.enabled && (
                                    <Input
                                        placeholder="e.g., $150,000"
                                        value={
                                            exposedMetrics.balance?.value ?? ''
                                        }
                                        onChange={(e) =>
                                            handleUpdateMetricValue(
                                                'balance',
                                                e.target.value,
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        {/* Embedding Options */}
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex-1">
                                <Label htmlFor="allow-embedding">
                                    Allow Embedding
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Enable this page to be embedded in iframes
                                </p>
                            </div>
                            <Switch
                                id="allow-embedding"
                                checked={allowEmbedding}
                                onCheckedChange={handleToggleEmbedding}
                                disabled={updateSettings.isPending}
                            />
                        </div>

                        {/* Public URL and Embed Code */}
                        <div className="space-y-3">
                            <div>
                                <Label>Public URL</Label>
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        value={embedUrl}
                                        readOnly
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            copyToClipboard(embedUrl)
                                        }
                                    >
                                        {copied ? (
                                            <Check className="size-4" />
                                        ) : (
                                            <Copy className="size-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                    >
                                        <a
                                            href={embedUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            {allowEmbedding && (
                                <div>
                                    <Label>Embed Code</Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Copy this code to embed the page on your
                                        website
                                    </p>
                                    <div className="flex gap-2">
                                        <Textarea
                                            value={embedCode}
                                            readOnly
                                            className="flex-1 font-mono text-xs"
                                            rows={3}
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                                copyToClipboard(embedCode)
                                            }
                                        >
                                            {copied ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Copy className="size-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
