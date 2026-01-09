'use client';

import {
    AlertCircle,
    Check,
    CreditCard,
    ExternalLink,
    Eye,
    EyeOff,
    Loader2,
    RefreshCw,
    Unplug,
} from 'lucide-react';
import { useState } from 'react';
import { AccountSelect } from '@/components/account-select';
import { DatePicker } from '@/components/date-picker';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    useDisconnectStripe,
    useGetStripeSettings,
    useSyncStripe,
    useTestStripeConnection,
    useUpdateStripeSettings,
} from '@/features/settings/api';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useConfirm } from '@/hooks/use-confirm';

export function StripeIntegrationCard() {
    const { data: settings, isLoading } = useGetStripeSettings();
    const { data: tags = [], isLoading: tagsLoading } = useGetTags();

    const updateSettings = useUpdateStripeSettings();
    const disconnectStripe = useDisconnectStripe();
    const testConnection = useTestStripeConnection();
    const syncStripe = useSyncStripe();

    const [ConfirmDialog, confirm] = useConfirm(
        'Disconnect Stripe',
        'Are you sure you want to disconnect Stripe? This will stop automatic transaction creation from Stripe payments.',
    );

    // Local state for secret key input (we don't show the actual key)
    const [secretKey, setSecretKey] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [showSecretKey, setShowSecretKey] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);
    const [syncFromDate, setSyncFromDate] = useState<Date | undefined>(
        settings?.syncFromDate ? new Date(settings.syncFromDate) : undefined,
    );

    const handleSaveSecretKey = () => {
        if (!secretKey.trim()) return;
        updateSettings.mutate(
            { stripeSecretKey: secretKey },
            {
                onSuccess: () => {
                    setSecretKey('');
                },
            },
        );
    };

    const handleSaveWebhookSecret = () => {
        if (!webhookSecret.trim()) return;
        updateSettings.mutate(
            { webhookSecret: webhookSecret },
            {
                onSuccess: () => {
                    setWebhookSecret('');
                },
            },
        );
    };

    const handleToggleEnabled = (checked: boolean) => {
        updateSettings.mutate({ isEnabled: checked });
    };

    const handleCreditAccountChange = (accountId: string) => {
        updateSettings.mutate({
            defaultCreditAccountId: accountId || null,
        });
    };

    const handleDebitAccountChange = (accountId: string) => {
        updateSettings.mutate({
            defaultDebitAccountId: accountId || null,
        });
    };

    const handleTagChange = (tagId: string) => {
        updateSettings.mutate({
            defaultTagId: tagId === 'none' ? null : tagId,
        });
    };

    const handleDisconnect = async () => {
        const ok = await confirm();
        if (ok) {
            disconnectStripe.mutate();
        }
    };

    const handleTestConnection = () => {
        testConnection.mutate();
    };

    const handleSync = () => {
        syncStripe.mutate();
    };

    const handleSyncFromDateChange = (date: Date | undefined) => {
        setSyncFromDate(date);
        updateSettings.mutate({
            syncFromDate: date ? date.toISOString() : null,
        });
    };

    if (isLoading || tagsLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Stripe Integration
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                    <Loader2 className="size-6 animate-spin text-slate-300" />
                </CardContent>
            </Card>
        );
    }

    const isConnected = settings?.hasSecretKey;
    const hasWebhookSecret = settings?.hasWebhookSecret;

    return (
        <>
            <ConfirmDialog />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Stripe Integration
                    </CardTitle>
                    <CardDescription>
                        Connect your Stripe account to automatically create
                        transactions from payments
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Connection Status */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                            {isConnected ? (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                    <AlertCircle className="h-5 w-5 text-gray-400" />
                                </div>
                            )}
                            <div>
                                <p className="font-medium">
                                    {isConnected
                                        ? 'Stripe Connected'
                                        : 'Not Connected'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {isConnected
                                        ? settings?.stripeAccountId ||
                                          'API key configured'
                                        : 'Add your Stripe secret key to connect'}
                                </p>
                            </div>
                        </div>
                        {isConnected && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTestConnection}
                                    disabled={testConnection.isPending}
                                >
                                    {testConnection.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Test Connection'
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDisconnect}
                                    disabled={disconnectStripe.isPending}
                                >
                                    <Unplug className="h-4 w-4 mr-1" />
                                    Disconnect
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Secret Key Input */}
                    <div className="space-y-2">
                        <Label htmlFor="stripe-secret-key">
                            Stripe Secret Key
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            {isConnected
                                ? 'Enter a new key to update your connection'
                                : 'Find this in your Stripe Dashboard under Developers → API keys'}
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="stripe-secret-key"
                                    type={showSecretKey ? 'text' : 'password'}
                                    placeholder={
                                        isConnected
                                            ? '••••••••••••••••'
                                            : 'sk_live_... or sk_test_...'
                                    }
                                    value={secretKey}
                                    onChange={(e) =>
                                        setSecretKey(e.target.value)
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() =>
                                        setShowSecretKey(!showSecretKey)
                                    }
                                >
                                    {showSecretKey ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <Button
                                onClick={handleSaveSecretKey}
                                disabled={
                                    !secretKey.trim() ||
                                    updateSettings.isPending
                                }
                            >
                                {updateSettings.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Webhook Section - only shown when connected */}
                    {isConnected && (
                        <>
                            <Separator />

                            <div>
                                <h4 className="font-medium">
                                    Instant transactions
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    Set up the webhook below to have
                                    transactions created instantly when payments
                                    occur. Without the webhook, payments will
                                    sync periodically.
                                </p>
                            </div>
                            {/* Webhook Setup Info */}
                            <div className="rounded-lg bg-muted p-4 space-y-2">
                                <h4 className="font-medium text-sm">
                                    Webhook Setup
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    Add this URL to your Stripe webhook
                                    endpoints to receive payment events:
                                </p>
                                <code className="block rounded bg-background px-3 py-2 text-xs break-all">
                                    {typeof window !== 'undefined'
                                        ? `${window.location.origin}/api/stripe/webhook`
                                        : '/api/stripe/webhook'}
                                </code>
                                <p className="text-xs text-muted-foreground">
                                    Events to subscribe:{' '}
                                    <span className="font-mono">
                                        charge.succeeded
                                    </span>
                                    ,{' '}
                                    <span className="font-mono">
                                        payment_intent.succeeded
                                    </span>
                                    ,{' '}
                                    <span className="font-mono">
                                        charge.refunded
                                    </span>
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    asChild
                                >
                                    <a
                                        href="https://dashboard.stripe.com/webhooks"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open Stripe Webhooks
                                        <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                </Button>
                            </div>

                            {/* Webhook Secret Input */}
                            <div className="space-y-2">
                                <Label htmlFor="stripe-webhook-secret">
                                    Webhook Signing Secret
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Required for automatic transaction creation.
                                    Copy from Stripe Dashboard after creating
                                    the webhook.
                                </p>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="stripe-webhook-secret"
                                            type={
                                                showWebhookSecret
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            placeholder={
                                                hasWebhookSecret
                                                    ? '••••••••••••••••'
                                                    : 'whsec_...'
                                            }
                                            value={webhookSecret}
                                            onChange={(e) =>
                                                setWebhookSecret(e.target.value)
                                            }
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3"
                                            onClick={() =>
                                                setShowWebhookSecret(
                                                    !showWebhookSecret,
                                                )
                                            }
                                        >
                                            {showWebhookSecret ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                    <Button
                                        onClick={handleSaveWebhookSecret}
                                        disabled={
                                            !webhookSecret.trim() ||
                                            updateSettings.isPending
                                        }
                                    >
                                        {updateSettings.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Save'
                                        )}
                                    </Button>
                                </div>
                                {hasWebhookSecret && (
                                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Webhook secret configured
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Default Transaction Settings */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium">
                                        Default Transaction Settings
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        These defaults will be applied to all
                                        transactions created from Stripe
                                        payments
                                    </p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Credit Account */}
                                    <div className="space-y-2">
                                        <Label>Default Credit Account</Label>
                                        <AccountSelect
                                            value={
                                                settings?.defaultCreditAccountId ||
                                                ''
                                            }
                                            onChange={handleCreditAccountChange}
                                            placeholder="Select account..."
                                            allowedTypes={['credit', 'neutral']}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Account that receives payment (e.g.,
                                            Bank Account)
                                        </p>
                                    </div>

                                    {/* Debit Account */}
                                    <div className="space-y-2">
                                        <Label>Default Debit Account</Label>
                                        <AccountSelect
                                            value={
                                                settings?.defaultDebitAccountId ||
                                                ''
                                            }
                                            onChange={handleDebitAccountChange}
                                            placeholder="Select account..."
                                            allowedTypes={['debit', 'neutral']}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Account that is debited (e.g.,
                                            Revenue)
                                        </p>
                                    </div>
                                </div>

                                {/* Tag */}
                                <div className="space-y-2">
                                    <Label>Default Tag</Label>
                                    <Select
                                        value={settings?.defaultTagId || 'none'}
                                        onValueChange={handleTagChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select tag..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                None
                                            </SelectItem>
                                            {tags.map((tag) => (
                                                <SelectItem
                                                    key={tag.id}
                                                    value={tag.id}
                                                >
                                                    {tag.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Tag for Stripe payment transactions
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {/* Sync From Date */}
                            <div className="space-y-2">
                                <Label>Import Historical Payments From</Label>
                                <DatePicker
                                    value={syncFromDate}
                                    onChange={handleSyncFromDateChange}
                                    disabled={updateSettings.isPending}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {settings?.syncFromDate
                                        ? `Importing payments from ${new Date(settings.syncFromDate).toLocaleDateString()}. Subsequent syncs only fetch new payments since last sync.`
                                        : 'Set how far back to import payments on first sync. Leave empty to default to 30 days ago. This will be saved after first sync.'}
                                </p>
                            </div>

                            <Separator />

                            {/* Sync Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="font-medium">
                                            Sync Payments
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            {hasWebhookSecret
                                                ? 'Payments sync automatically via webhook. Use manual sync if needed.'
                                                : 'Without webhook, payments sync every full hour. You can also sync manually.'}
                                        </p>
                                        {!settings?.isEnabled && (
                                            <p className="text-xs text-muted-foreground italic">
                                                Enable the integration below to
                                                start syncing
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSync}
                                        disabled={
                                            syncStripe.isPending ||
                                            !settings?.isEnabled
                                        }
                                    >
                                        {syncStripe.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4 mr-1" />
                                        )}
                                        Sync Now
                                    </Button>
                                </div>
                                {settings?.lastSyncAt && (
                                    <p className="text-xs text-muted-foreground">
                                        Last sync:{' '}
                                        {new Date(
                                            settings.lastSyncAt,
                                        ).toLocaleString()}
                                    </p>
                                )}
                                {!hasWebhookSecret && settings?.isEnabled && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Running in polling mode - payments sync
                                        hourly
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Enable/Disable Toggle - at the bottom */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Enable Integration</Label>
                                    <p className="text-xs text-muted-foreground">
                                        When enabled, Stripe payments will
                                        automatically create transactions
                                    </p>
                                </div>
                                <Switch
                                    checked={settings?.isEnabled ?? false}
                                    onCheckedChange={handleToggleEnabled}
                                    disabled={updateSettings.isPending}
                                />
                            </div>

                            {!hasWebhookSecret && !settings?.isEnabled && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Webhook not configured - will use hourly
                                    polling instead
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
