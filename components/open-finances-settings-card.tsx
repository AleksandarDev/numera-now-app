'use client';

import { useAuth } from '@clerk/nextjs';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Check, Copy, ExternalLink, Info, Loader2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGetOpenFinancesSettings } from '@/features/open-finances/api/use-get-open-finances-settings';
import { useUpdateOpenFinancesSettings } from '@/features/open-finances/api/use-update-open-finances-settings';

type MetricConfig = {
    enabled: boolean;
    label: string;
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
                    <p className="text-sm text-muted-foreground">Loading...</p>
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
                <p className="text-sm text-muted-foreground">
                    Share selected financial data publicly with transparency.
                    Control what information is visible and how it's displayed.
                </p>
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

                {/* Instructions - Always visible */}
                {!isEnabled && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <Info className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-blue-900">
                                    How to Share Your Financial Transparency
                                </p>
                                <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                                    <li>
                                        Enable Open Finances using the toggle
                                        above
                                    </li>
                                    <li>
                                        Configure which metrics you want to
                                        share publicly
                                    </li>
                                    <li>
                                        Metrics will be automatically calculated
                                        from your transactions
                                    </li>
                                    <li>
                                        Copy the public URL to share directly,
                                        or use the embed code to add it to your
                                        website
                                    </li>
                                </ol>
                                <p className="text-xs text-blue-700 mt-2">
                                    Your public page will be available at:{' '}
                                    <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">
                                        {embedUrl ||
                                            '/open-finances/[your-user-id]'}
                                    </code>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
                                Select which financial metrics to share
                                publicly. Values are automatically calculated
                                from your transactions.
                            </p>

                            {/* Revenue */}
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <Label htmlFor="metric-revenue">
                                            Revenue
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Total income from your transactions
                                        </p>
                                    </div>
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
                            </div>

                            {/* Expenses */}
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <Label htmlFor="metric-expenses">
                                            Expenses
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Total expenses from your
                                            transactions
                                        </p>
                                    </div>
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
                            </div>

                            {/* Profit */}
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <Label htmlFor="metric-profit">
                                            Profit
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Net profit (revenue - expenses)
                                        </p>
                                    </div>
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
                            </div>

                            {/* Balance */}
                            <div className="rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <Label htmlFor="metric-balance">
                                            Balance
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Current account balance (assets -
                                            liabilities)
                                        </p>
                                    </div>
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

                        {/* Sharing & Embedding Section - More Prominent */}
                        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Share2 className="size-5 text-green-700" />
                                <h3 className="font-semibold text-green-900">
                                    Share Your Transparency Page
                                </h3>
                            </div>

                            <div className="space-y-3">
                                {/* Public URL */}
                                <div>
                                    <Label className="text-green-900">
                                        Public URL
                                    </Label>
                                    <p className="text-xs text-green-700 mb-2">
                                        Share this link directly with your
                                        stakeholders or on social media
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={embedUrl}
                                            readOnly
                                            className="flex-1 bg-white"
                                        />
                                        <Button
                                            variant="outlined"
                                            className="h-10 w-10 p-0"
                                            onClick={() =>
                                                copyToClipboard(embedUrl)
                                            }
                                            title="Copy URL"
                                        >
                                            {copied ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Copy className="size-4" />
                                            )}
                                        </Button>
                                        <a
                                            href={embedUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center h-10 w-10 p-0 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                    </div>
                                </div>

                                {/* Embed Code */}
                                {allowEmbedding && (
                                    <div>
                                        <Label className="text-green-900">
                                            Embed Code
                                        </Label>
                                        <p className="text-xs text-green-700 mb-2">
                                            Copy this code to embed the
                                            transparency page on your website
                                        </p>
                                        <div className="flex gap-2">
                                            <Textarea
                                                value={embedCode}
                                                readOnly
                                                className="flex-1 font-mono text-xs bg-white"
                                                rows={3}
                                            />
                                            <Button
                                                variant="outlined"
                                                className="h-10 w-10 p-0"
                                                onClick={() =>
                                                    copyToClipboard(embedCode)
                                                }
                                                title="Copy embed code"
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

                                {/* Usage Instructions */}
                                <div className="text-xs text-green-800 bg-green-100 p-3 rounded-md">
                                    <p className="font-medium mb-1">
                                        💡 Quick Guide:
                                    </p>
                                    <ul className="space-y-1 list-disc list-inside">
                                        <li>
                                            Use the URL to link from your
                                            website or share on social media
                                        </li>
                                        {allowEmbedding && (
                                            <li>
                                                Use the embed code to display
                                                the page directly on your
                                                website
                                            </li>
                                        )}
                                        <li>
                                            Metrics are calculated automatically
                                            from your real transaction data
                                        </li>
                                        <li>
                                            Only enabled metrics are visible to
                                            the public
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
