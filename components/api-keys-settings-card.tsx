'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import {
    Copy,
    KeyRound,
    Loader2,
    Plus,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    useCreateApiKey,
    useGetApiKeys,
    useRevokeApiKey,
} from '@/features/settings/api';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';

type ApiKeyRecord = NonNullable<
    ReturnType<typeof useGetApiKeys>['data']
>[number];

const formatDateTime = (value: Date | string | null | undefined) => {
    if (!value) {
        return 'Never';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
};

const isKeyExpired = (key: ApiKeyRecord) =>
    key.expiresAt ? new Date(key.expiresAt).getTime() <= Date.now() : false;

const getKeyStatus = (key: ApiKeyRecord) => {
    if (key.revokedAt) {
        return {
            label: 'Revoked',
            variant: 'destructive' as const,
        };
    }

    if (isKeyExpired(key)) {
        return {
            label: 'Expired',
            variant: 'secondary' as const,
        };
    }

    return {
        label: 'Active',
        variant: 'primary' as const,
    };
};

export function ApiKeysSettingsCard() {
    const apiKeysQuery = useGetApiKeys();
    const createApiKey = useCreateApiKey();
    const revokeApiKey = useRevokeApiKey();
    const [name, setName] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [createdKey, setCreatedKey] = useState<{
        name: string;
        apiKey: string;
    } | null>(null);
    const [ConfirmDialog, confirm] = useConfirm(
        'Revoke API Key',
        'Are you sure you want to revoke this API key? Existing external integrations using it will stop working.',
    );

    const apiKeys = apiKeysQuery.data ?? [];

    const handleCreate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            return;
        }

        createApiKey.mutate(
            {
                name: trimmedName,
                scopes: ['ingest:write'],
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            },
            {
                onSuccess: (response) => {
                    if ('apiKey' in response) {
                        setCreatedKey({
                            name: response.data.name,
                            apiKey: response.apiKey,
                        });
                    }
                    setName('');
                    setExpiresAt('');
                },
            },
        );
    };

    const handleRevoke = async (id: string) => {
        const ok = await confirm();
        if (ok) {
            revokeApiKey.mutate({ id });
        }
    };

    const handleCopy = async () => {
        if (!createdKey) {
            return;
        }

        await navigator.clipboard.writeText(createdKey.apiKey);
        toast.success('API key copied.');
    };

    return (
        <>
            <ConfirmDialog />
            <Dialog
                open={createdKey !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreatedKey(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>API Key Created</DialogTitle>
                        <DialogDescription>
                            The full key is shown only once. Store it before
                            closing this dialog.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="created-api-key">
                            {createdKey?.name}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="created-api-key"
                                value={createdKey?.apiKey ?? ''}
                                readOnly
                                className="font-mono text-xs"
                            />
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={handleCopy}
                            >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setCreatedKey(null)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        API Keys
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Manage server-to-server keys for external receipt and
                        invoice ingestion.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form
                        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]"
                        onSubmit={handleCreate}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="api-key-name">Name</Label>
                            <Input
                                id="api-key-name"
                                placeholder="ERP production"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                disabled={createApiKey.isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="api-key-expires-at">
                                Expiration
                            </Label>
                            <Input
                                id="api-key-expires-at"
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(event) =>
                                    setExpiresAt(event.target.value)
                                }
                                disabled={createApiKey.isPending}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                type="submit"
                                className="w-full lg:w-auto"
                                disabled={
                                    createApiKey.isPending || !name.trim()
                                }
                            >
                                {createApiKey.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                Create key
                            </Button>
                        </div>
                    </form>

                    <div className="overflow-hidden rounded-md border">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead className="border-b bg-muted/40">
                                    <tr className="text-left">
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Name
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Key
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Scopes
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Last used
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Status
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right font-medium"
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {apiKeysQuery.isLoading ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-muted-foreground"
                                            >
                                                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                            </td>
                                        </tr>
                                    ) : apiKeys.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-8 text-center text-muted-foreground"
                                            >
                                                No API keys.
                                            </td>
                                        </tr>
                                    ) : (
                                        apiKeys.map((key) => {
                                            const status = getKeyStatus(key);
                                            const canRevoke =
                                                !key.revokedAt &&
                                                !isKeyExpired(key);

                                            return (
                                                <tr
                                                    key={key.id}
                                                    className="border-b last:border-0"
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">
                                                            {key.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Created{' '}
                                                            {formatDateTime(
                                                                key.createdAt,
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                                                            {key.keyPrefix}...
                                                            {key.keySuffix}
                                                        </code>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {key.scopes.map(
                                                                (scope) => (
                                                                    <Badge
                                                                        key={
                                                                            scope
                                                                        }
                                                                        variant="secondary"
                                                                        className="gap-1"
                                                                    >
                                                                        <ShieldCheck className="h-3 w-3" />
                                                                        {scope}
                                                                    </Badge>
                                                                ),
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {formatDateTime(
                                                            key.lastUsedAt,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge
                                                            variant={
                                                                status.variant
                                                            }
                                                            className={cn(
                                                                status.label ===
                                                                    'Expired' &&
                                                                    'text-muted-foreground',
                                                            )}
                                                        >
                                                            {status.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="outlined"
                                                            size="sm"
                                                            disabled={
                                                                !canRevoke ||
                                                                revokeApiKey.isPending
                                                            }
                                                            onClick={() =>
                                                                void handleRevoke(
                                                                    key.id,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Revoke
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
