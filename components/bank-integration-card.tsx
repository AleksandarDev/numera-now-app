'use client';

import {
    AlertCircle,
    Building2,
    Check,
    ExternalLink,
    Link2,
    Loader2,
    Plus,
    RefreshCw,
    Trash2,
    Unplug,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    useCompleteBankConnection,
    useCreateBankConnection,
    useDeleteBankConnection,
    useDisconnectBanking,
    useGetBankConnections,
    useGetBankingSettings,
    useGetInstitutions,
    useSyncBanking,
    useTestBankingConnection,
    useUpdateBankAccount,
    useUpdateBankingSettings,
} from '@/features/settings/api';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useConfirm } from '@/hooks/use-confirm';
import { bankingProviderConfig } from '@/lib/banking/provider-config';

const SUPPORTED_COUNTRIES = bankingProviderConfig.supportedCountries;

interface Institution {
    id: string;
    name: string;
    bic: string;
    logo: string;
    transactionTotalDays: string;
    maxAccessValidForDays?: string;
    country: string;
    countries: string[];
}

interface BankAccount {
    id: string;
    connectionId: string;
    userId: string;
    gocardlessAccountId: string;
    iban: string | null;
    name: string | null;
    ownerName: string | null;
    currency: string | null;
    linkedAccountId: string | null;
    lastSyncAt: string | null;
    lastTransactionDate: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface BankConnection {
    id: string;
    userId: string;
    requisitionId: string;
    institutionId: string;
    institutionName: string;
    institutionLogo: string | null;
    agreementId: string | null;
    agreementExpiresAt: string | null;
    status:
        | 'pending'
        | 'linked'
        | 'expired'
        | 'revoked'
        | 'suspended'
        | 'error';
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
    accounts: BankAccount[];
}

export function BankIntegrationCard() {
    const { data: settings, isLoading } = useGetBankingSettings();
    const { data: connections = [] } = useGetBankConnections();
    const { data: tags = [], isLoading: tagsLoading } = useGetTags();

    const updateSettings = useUpdateBankingSettings();
    const disconnectBanking = useDisconnectBanking();
    const testConnection = useTestBankingConnection();
    const syncBanking = useSyncBanking();
    const createConnection = useCreateBankConnection();
    const completeConnection = useCompleteBankConnection();
    const deleteConnection = useDeleteBankConnection();
    const updateBankAccount = useUpdateBankAccount();

    // Local state
    const [applicationId, setApplicationId] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(
        bankingProviderConfig.supportedCountries[0]?.code ?? 'HR',
    );
    const [addBankDialogOpen, setAddBankDialogOpen] = useState(false);
    const [pendingConnectionId, setPendingConnectionId] = useState<
        string | null
    >(null);
    const [syncFromDate, setSyncFromDate] = useState<Date | undefined>(
        settings?.syncFromDate ? new Date(settings.syncFromDate) : undefined,
    );

    const {
        data: institutions,
        refetch: fetchInstitutions,
        isFetching: institutionsFetching,
    } = useGetInstitutions(selectedCountry);

    const [ConfirmDialog, confirm] = useConfirm(
        'Disconnect Bank Integration',
        'Are you sure you want to disconnect? This will remove all bank connections and stop automatic transaction imports.',
    );

    const [DeleteConnectionDialog, confirmDeleteConnection] = useConfirm(
        'Remove Bank Connection',
        'Are you sure you want to remove this bank connection? You can reconnect later.',
    );

    // Check for pending connection callback
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const codeFromUrl = urlParams.get('code');
            const stateFromUrl = urlParams.get('state');
            const ref = urlParams.get('ref');

            if (codeFromUrl) {
                window.sessionStorage.setItem('bankingAuthCode', codeFromUrl);
            }
            if (stateFromUrl) {
                window.sessionStorage.setItem('bankingAuthState', stateFromUrl);
            }

            const code =
                codeFromUrl || window.sessionStorage.getItem('bankingAuthCode');
            const state =
                stateFromUrl ||
                window.sessionStorage.getItem('bankingAuthState');

            if (code || ref) {
                const pendingConn =
                    (connections as BankConnection[]).find(
                        (c) => c.id === state,
                    ) ||
                    (connections as BankConnection[]).find(
                        (c) => c.status === 'pending',
                    );
                if (pendingConn && code && !completeConnection.isPending) {
                    setPendingConnectionId(pendingConn.id);
                    completeConnection.mutate({
                        connectionId: pendingConn.id,
                        code,
                    });
                    window.sessionStorage.removeItem('bankingAuthCode');
                    window.sessionStorage.removeItem('bankingAuthState');

                    // Clean up URL
                    window.history.replaceState(
                        {},
                        document.title,
                        window.location.pathname,
                    );
                }
            }
        }
    }, [connections, completeConnection]);

    const handleSaveCredentials = () => {
        if (!applicationId.trim() || !privateKey.trim()) return;
        updateSettings.mutate(
            { secretId: applicationId, secretKey: privateKey },
            {
                onSuccess: () => {
                    setApplicationId('');
                    setPrivateKey('');
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
            disconnectBanking.mutate();
        }
    };

    const handleTestConnection = () => {
        testConnection.mutate();
    };

    const handleSync = () => {
        syncBanking.mutate();
    };

    const handleSyncFromDateChange = (date: Date | undefined) => {
        setSyncFromDate(date);
        updateSettings.mutate({
            syncFromDate: date ? date.toISOString() : null,
        });
    };

    const handleCountryChange = (country: string) => {
        setSelectedCountry(country);
    };

    const handleFetchInstitutions = () => {
        fetchInstitutions();
    };

    const handleConnectBank = useCallback(
        (institution: Institution) => {
            const redirectUrl =
                typeof window !== 'undefined'
                    ? `${window.location.origin}${window.location.pathname}`
                    : '';

            createConnection.mutate(
                {
                    institutionId: institution.id,
                    institutionName: institution.name,
                    institutionLogo: institution.logo,
                    institutionCountry: institution.country,
                    redirectUrl,
                },
                {
                    onSuccess: (data) => {
                        if ('data' in data && data.data.authorizationLink) {
                            // Open authorization link in new window
                            window.open(
                                data.data.authorizationLink,
                                '_blank',
                                'noopener,noreferrer',
                            );
                            setAddBankDialogOpen(false);
                        }
                    },
                },
            );
        },
        [createConnection],
    );

    const handleDeleteConnection = async (connectionId: string) => {
        const ok = await confirmDeleteConnection();
        if (ok) {
            deleteConnection.mutate({ connectionId });
        }
    };

    const handleLinkAccount = (
        bankAccountId: string,
        linkedAccountId: string | null,
    ) => {
        updateBankAccount.mutate({
            accountId: bankAccountId,
            linkedAccountId,
        });
    };

    const handleToggleBankAccount = (
        bankAccountId: string,
        isActive: boolean,
    ) => {
        updateBankAccount.mutate({
            accountId: bankAccountId,
            isActive,
        });
    };

    if (isLoading || tagsLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Bank Integration
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                    <Loader2 className="size-6 animate-spin text-slate-300" />
                </CardContent>
            </Card>
        );
    }

    const isConnected = settings?.hasSecretId && settings?.hasSecretKey;
    const linkedConnections = (connections as BankConnection[]).filter(
        (c) => c.status === 'linked',
    );
    const pendingConnections = (connections as BankConnection[]).filter(
        (c) => c.status === 'pending',
    );
    const reconnectConnections = (connections as BankConnection[]).filter(
        (c) =>
            c.status === 'expired' ||
            c.status === 'revoked' ||
            c.status === 'suspended' ||
            c.status === 'error',
    );

    return (
        <>
            <ConfirmDialog />
            <DeleteConnectionDialog />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Bank Integration
                    </CardTitle>
                    <CardDescription>
                        Connect your bank accounts via{' '}
                        {bankingProviderConfig.name} to automatically import
                        transactions
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
                                        ? `${bankingProviderConfig.name} Connected`
                                        : 'Not Connected'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {isConnected
                                        ? `${linkedConnections.length} bank${linkedConnections.length !== 1 ? 's' : ''} connected`
                                        : `Add your ${bankingProviderConfig.name} API credentials to connect`}
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
                                    disabled={disconnectBanking.isPending}
                                >
                                    <Unplug className="h-4 w-4 mr-1" />
                                    Disconnect
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* API Credentials Input */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="banking-application-id">
                                {bankingProviderConfig.credentials.idLabel}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {isConnected
                                    ? 'Enter new credentials to update'
                                    : bankingProviderConfig.credentials.idHelp}
                            </p>
                            <Input
                                id="banking-application-id"
                                type="text"
                                placeholder={
                                    isConnected
                                        ? '••••••••••••••••'
                                        : bankingProviderConfig.credentials
                                              .idPlaceholder
                                }
                                value={applicationId}
                                onChange={(e) =>
                                    setApplicationId(e.target.value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="banking-private-key">
                                {bankingProviderConfig.credentials.keyLabel}
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Textarea
                                        id="banking-private-key"
                                        placeholder={
                                            isConnected
                                                ? '••••••••••••••••'
                                                : bankingProviderConfig
                                                      .credentials
                                                      .keyPlaceholder
                                        }
                                        value={privateKey}
                                        onChange={(e) =>
                                            setPrivateKey(e.target.value)
                                        }
                                        className="font-mono"
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {
                                            bankingProviderConfig.credentials
                                                .keyHelp
                                        }
                                    </p>
                                </div>
                                <Button
                                    onClick={handleSaveCredentials}
                                    disabled={
                                        !applicationId.trim() ||
                                        !privateKey.trim() ||
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

                        <div className="rounded-lg bg-muted p-4 space-y-2">
                            <h4 className="font-medium text-sm">
                                Getting {bankingProviderConfig.name} Credentials
                            </h4>
                            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                                <li>
                                    Generate an RSA key pair and self-signed
                                    certificate (see the Enable Banking docs)
                                </li>
                                <li>
                                    Upload the certificate in the Enable Banking
                                    dashboard to get an Application ID
                                </li>
                                <li>
                                    Paste the Application ID and the RSA private
                                    key here
                                </li>
                            </ol>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                asChild
                            >
                                <a
                                    href={bankingProviderConfig.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open {bankingProviderConfig.name} Docs
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Connected Banks Section - only shown when connected */}
                    {isConnected && (
                        <>
                            <Separator />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">
                                            Connected Banks
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            Manage your connected bank accounts
                                        </p>
                                    </div>
                                    <Dialog
                                        open={addBankDialogOpen}
                                        onOpenChange={setAddBankDialogOpen}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Bank
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Connect a Bank
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Select your country and bank
                                                    to connect
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="flex gap-2">
                                                    <Select
                                                        value={selectedCountry}
                                                        onValueChange={
                                                            handleCountryChange
                                                        }
                                                    >
                                                        <SelectTrigger className="w-[200px]">
                                                            <SelectValue placeholder="Select country" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {SUPPORTED_COUNTRIES.map(
                                                                (country) => (
                                                                    <SelectItem
                                                                        key={
                                                                            country.code
                                                                        }
                                                                        value={
                                                                            country.code
                                                                        }
                                                                    >
                                                                        {
                                                                            country.name
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        onClick={
                                                            handleFetchInstitutions
                                                        }
                                                        disabled={
                                                            institutionsFetching
                                                        }
                                                    >
                                                        {institutionsFetching ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                        ) : null}
                                                        Load Banks
                                                    </Button>
                                                </div>

                                                {institutions &&
                                                    institutions.length > 0 && (
                                                        <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                                                            {(
                                                                institutions as Institution[]
                                                            ).map(
                                                                (
                                                                    institution,
                                                                ) => (
                                                                    <button
                                                                        key={
                                                                            institution.id
                                                                        }
                                                                        type="button"
                                                                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                                                                        onClick={() =>
                                                                            handleConnectBank(
                                                                                institution,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            createConnection.isPending
                                                                        }
                                                                    >
                                                                        {institution.logo && (
                                                                            <Image
                                                                                src={
                                                                                    institution.logo
                                                                                }
                                                                                alt={
                                                                                    institution.name
                                                                                }
                                                                                width={
                                                                                    40
                                                                                }
                                                                                height={
                                                                                    40
                                                                                }
                                                                                className="rounded"
                                                                            />
                                                                        )}
                                                                        <div className="flex-1">
                                                                            <p className="font-medium">
                                                                                {
                                                                                    institution.name
                                                                                }
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {
                                                                                    institution.bic
                                                                                }{' '}
                                                                                •
                                                                                Up
                                                                                to{' '}
                                                                                {
                                                                                    institution.transactionTotalDays
                                                                                }{' '}
                                                                                days
                                                                                history
                                                                            </p>
                                                                        </div>
                                                                        <Link2 className="h-4 w-4 text-muted-foreground" />
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                {/* Pending Connections */}
                                {pendingConnections.length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-sm font-medium text-muted-foreground">
                                            Pending Authorization
                                        </h5>
                                        {pendingConnections.map(
                                            (connection) => (
                                                <div
                                                    key={connection.id}
                                                    className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 p-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {connection.institutionLogo && (
                                                            <Image
                                                                src={
                                                                    connection.institutionLogo
                                                                }
                                                                alt={
                                                                    connection.institutionName
                                                                }
                                                                width={32}
                                                                height={32}
                                                                className="rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">
                                                                {
                                                                    connection.institutionName
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {completeConnection.isPending &&
                                                                pendingConnectionId ===
                                                                    connection.id
                                                                    ? 'Completing authorization...'
                                                                    : 'Awaiting authorization'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDeleteConnection(
                                                                    connection.id,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                                {/* Connections Needing Reauthorization */}
                                {reconnectConnections.length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-sm font-medium text-muted-foreground">
                                            Needs Reauthorization
                                        </h5>
                                        {reconnectConnections.map(
                                            (connection) => (
                                                <div
                                                    key={connection.id}
                                                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {connection.institutionLogo && (
                                                            <Image
                                                                src={
                                                                    connection.institutionLogo
                                                                }
                                                                alt={
                                                                    connection.institutionName
                                                                }
                                                                width={32}
                                                                height={32}
                                                                className="rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">
                                                                {
                                                                    connection.institutionName
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {connection.status ===
                                                                'expired'
                                                                    ? 'Authorization expired'
                                                                    : connection.status ===
                                                                        'revoked'
                                                                      ? 'Authorization revoked'
                                                                      : connection.status ===
                                                                          'suspended'
                                                                        ? 'Authorization suspended'
                                                                        : 'Connection error'}
                                                            </p>
                                                            {connection.lastError && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    {
                                                                        connection.lastError
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDeleteConnection(
                                                                    connection.id,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                                {/* Linked Connections */}
                                {linkedConnections.length > 0 ? (
                                    <div className="space-y-3">
                                        {linkedConnections.map((connection) => (
                                            <div
                                                key={connection.id}
                                                className="rounded-lg border p-4 space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {connection.institutionLogo && (
                                                            <Image
                                                                src={
                                                                    connection.institutionLogo
                                                                }
                                                                alt={
                                                                    connection.institutionName
                                                                }
                                                                width={40}
                                                                height={40}
                                                                className="rounded"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">
                                                                {
                                                                    connection.institutionName
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {
                                                                    connection
                                                                        .accounts
                                                                        .length
                                                                }{' '}
                                                                account
                                                                {connection
                                                                    .accounts
                                                                    .length !==
                                                                1
                                                                    ? 's'
                                                                    : ''}{' '}
                                                                •{' '}
                                                                {connection.agreementExpiresAt
                                                                    ? `Expires ${new Date(connection.agreementExpiresAt).toLocaleDateString()}`
                                                                    : 'Connected'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDeleteConnection(
                                                                connection.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Bank Accounts */}
                                                {connection.accounts.length >
                                                    0 && (
                                                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                                                        {connection.accounts.map(
                                                            (account) => (
                                                                <div
                                                                    key={
                                                                        account.id
                                                                    }
                                                                    className="flex items-center justify-between py-2"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <Switch
                                                                            checked={
                                                                                account.isActive
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) =>
                                                                                handleToggleBankAccount(
                                                                                    account.id,
                                                                                    checked,
                                                                                )
                                                                            }
                                                                        />
                                                                        <div>
                                                                            <p className="text-sm font-medium">
                                                                                {account.name ||
                                                                                    account.iban ||
                                                                                    'Bank Account'}
                                                                            </p>
                                                                            {account.iban && (
                                                                                <p className="text-xs text-muted-foreground font-mono">
                                                                                    {
                                                                                        account.iban
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-[200px]">
                                                                        <AccountSelect
                                                                            value={
                                                                                account.linkedAccountId ||
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                value,
                                                                            ) =>
                                                                                handleLinkAccount(
                                                                                    account.id,
                                                                                    value ||
                                                                                        null,
                                                                                )
                                                                            }
                                                                            placeholder="Link to account..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    pendingConnections.length === 0 &&
                                    reconnectConnections.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p>No banks connected yet</p>
                                            <p className="text-sm">
                                                Click "Add Bank" to connect your
                                                first bank
                                            </p>
                                        </div>
                                    )
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
                                        transactions imported from banks
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
                                            For incoming transfers (fallback if
                                            not linked)
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
                                            For outgoing transfers (fallback if
                                            not linked)
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
                                        Tag for bank transactions
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {/* Sync From Date */}
                            <div className="space-y-2">
                                <Label>
                                    Import Historical Transactions From
                                </Label>
                                <DatePicker
                                    value={syncFromDate}
                                    onChange={handleSyncFromDateChange}
                                    disabled={updateSettings.isPending}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {settings?.syncFromDate
                                        ? `Importing transactions from ${new Date(settings.syncFromDate).toLocaleDateString()}. Subsequent syncs only fetch new transactions since last sync.`
                                        : 'Set how far back to import transactions on first sync. Leave empty to default to 30 days ago. This will be saved after first sync.'}
                                </p>
                            </div>

                            <Separator />

                            {/* Sync Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="font-medium">
                                            Sync Transactions
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            Import new transactions from all
                                            active bank accounts
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Sync runs on demand only for now.
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
                                            syncBanking.isPending ||
                                            !settings?.isEnabled ||
                                            linkedConnections.length === 0
                                        }
                                    >
                                        {syncBanking.isPending ? (
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
                            </div>

                            <Separator />

                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Enable Integration</Label>
                                    <p className="text-xs text-muted-foreground">
                                        When enabled, bank transactions can be
                                        synced
                                    </p>
                                </div>
                                <Switch
                                    checked={settings?.isEnabled ?? false}
                                    onCheckedChange={handleToggleEnabled}
                                    disabled={updateSettings.isPending}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
