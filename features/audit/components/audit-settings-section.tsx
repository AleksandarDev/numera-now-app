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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { AuditEvent } from '@/features/audit/api/use-get-audit-events';
import { useGetAuditEvents } from '@/features/audit/api/use-get-audit-events';
import { useGetDeletedDocuments } from '@/features/audit/api/use-get-deleted-documents';
import { useGetDeletedTransactions } from '@/features/audit/api/use-get-deleted-transactions';
import { useRestoreDocument } from '@/features/audit/api/use-restore-document';
import { useRestoreTransaction } from '@/features/audit/api/use-restore-transaction';
import { useRevertCustomerAuditEvent } from '@/features/audit/api/use-revert-customer-audit-event';
import { AuditEventList } from '@/features/audit/components/audit-event-list';
import { formatCurrency } from '@/lib/utils';

const resourceTypes = [
    'transaction',
    'document',
    'customer',
    'customer_iban',
    'account',
    'tag',
] as const;

const actions = [
    'create',
    'update',
    'delete',
    'restore',
    'purge',
    'import',
    'sync',
    'status_change',
    'link',
    'unlink',
] as const;

const formatDateTime = (value?: string | Date | null) =>
    value ? format(new Date(value), 'MMM d, yyyy HH:mm') : 'Unknown';

export function AuditSettingsSection() {
    const [resourceType, setResourceType] = useState('all');
    const [action, setAction] = useState('all');
    const [resourceId, setResourceId] = useState('');
    const [source, setSource] = useState('');
    const [revertingEventId, setRevertingEventId] = useState<string | null>(
        null,
    );

    const filters = useMemo(
        () => ({
            resourceType: resourceType === 'all' ? undefined : resourceType,
            action: action === 'all' ? undefined : action,
            resourceId: resourceId.trim() || undefined,
            source: source.trim() || undefined,
            limit: 100,
        }),
        [action, resourceId, resourceType, source],
    );

    const auditEventsQuery = useGetAuditEvents(filters);
    const deletedTransactionsQuery = useGetDeletedTransactions();
    const deletedDocumentsQuery = useGetDeletedDocuments();
    const restoreTransaction = useRestoreTransaction();
    const restoreDocument = useRestoreDocument();
    const revertCustomerAuditEvent = useRevertCustomerAuditEvent();

    const handleRevertCustomerEvent = async (
        event: AuditEvent,
        customerId: string,
    ) => {
        if (!window.confirm('Revert this customer change?')) {
            return;
        }

        setRevertingEventId(event.id);
        try {
            await revertCustomerAuditEvent.mutateAsync({
                customerId,
                auditEventId: event.id,
                reason: 'Reverted from audit log',
            });
        } finally {
            setRevertingEventId(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Audit</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="log" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="log">Log</TabsTrigger>
                        <TabsTrigger value="trash">Trash</TabsTrigger>
                    </TabsList>

                    <TabsContent value="log" className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="audit-resource-type">
                                    Resource
                                </Label>
                                <Select
                                    value={resourceType}
                                    onValueChange={setResourceType}
                                >
                                    <SelectTrigger id="audit-resource-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All resources
                                        </SelectItem>
                                        {resourceTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="audit-action">Action</Label>
                                <Select
                                    value={action}
                                    onValueChange={setAction}
                                >
                                    <SelectTrigger id="audit-action">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All actions
                                        </SelectItem>
                                        {actions.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="audit-resource-id">
                                    Resource ID
                                </Label>
                                <Input
                                    id="audit-resource-id"
                                    value={resourceId}
                                    onChange={(event) =>
                                        setResourceId(event.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="audit-source">Source</Label>
                                <Input
                                    id="audit-source"
                                    value={source}
                                    onChange={(event) =>
                                        setSource(event.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <AuditEventList
                            events={auditEventsQuery.data}
                            isLoading={auditEventsQuery.isLoading}
                            isError={auditEventsQuery.isError}
                            onRevertCustomerEvent={handleRevertCustomerEvent}
                            revertingEventId={revertingEventId}
                        />
                    </TabsContent>

                    <TabsContent value="trash" className="space-y-6">
                        <section className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold">
                                    Transactions
                                </h2>
                                <span className="text-sm text-muted-foreground">
                                    {deletedTransactionsQuery.data?.length ?? 0}
                                </span>
                            </div>
                            {deletedTransactionsQuery.isLoading ? (
                                <div className="h-24 animate-pulse rounded-md border bg-muted/30" />
                            ) : deletedTransactionsQuery.isError ? (
                                <div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">
                                    Failed to load deleted transactions.
                                </div>
                            ) : deletedTransactionsQuery.data?.length ? (
                                <div className="divide-y rounded-md border">
                                    {deletedTransactionsQuery.data.map(
                                        (transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="flex items-center justify-between gap-3 p-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">
                                                        {transaction.payeeCustomerName ||
                                                            transaction.payee ||
                                                            'Untitled transaction'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDateTime(
                                                            transaction.deletedAt,
                                                        )}{' '}
                                                        -{' '}
                                                        {formatCurrency(
                                                            transaction.amount,
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outlined"
                                                    disabled={
                                                        restoreTransaction.isPending
                                                    }
                                                    onClick={() =>
                                                        restoreTransaction.mutate(
                                                            transaction.id,
                                                        )
                                                    }
                                                >
                                                    <RotateCcw className="mr-2 size-4" />
                                                    Restore
                                                </Button>
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                    No deleted transactions.
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold">
                                    Documents
                                </h2>
                                <span className="text-sm text-muted-foreground">
                                    {deletedDocumentsQuery.data?.length ?? 0}
                                </span>
                            </div>
                            {deletedDocumentsQuery.isLoading ? (
                                <div className="h-24 animate-pulse rounded-md border bg-muted/30" />
                            ) : deletedDocumentsQuery.isError ? (
                                <div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">
                                    Failed to load deleted documents.
                                </div>
                            ) : deletedDocumentsQuery.data?.length ? (
                                <div className="divide-y rounded-md border">
                                    {deletedDocumentsQuery.data.map(
                                        (document) => (
                                            <div
                                                key={document.id}
                                                className="flex items-center justify-between gap-3 p-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">
                                                        {document.fileName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDateTime(
                                                            document.deletedAt,
                                                        )}{' '}
                                                        -{' '}
                                                        {document.documentTypeName ||
                                                            'Unknown type'}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outlined"
                                                    disabled={
                                                        restoreDocument.isPending
                                                    }
                                                    onClick={() =>
                                                        restoreDocument.mutate(
                                                            document.id,
                                                        )
                                                    }
                                                >
                                                    <RotateCcw className="mr-2 size-4" />
                                                    Restore
                                                </Button>
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                    No deleted documents.
                                </div>
                            )}
                        </section>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
