import { Button } from '@signalco/ui-primitives/Button';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { useQueries } from '@tanstack/react-query';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import React, { Fragment, useMemo, useState } from 'react';
import type { z } from 'zod';
import { DocumentsTab } from '@/components/documents-tab';
import { StatusProgression } from '@/components/status-progression';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { UserAvatar } from '@/components/user-avatar';
import { insertTransactionSchema } from '@/db/schema';
import { useCreateAccount } from '@/features/accounts/api/use-create-account';
import { useCreateCustomer } from '@/features/customers/api/use-create-customer';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { useCreateTag } from '@/features/tags/api/use-create-tag';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useCanReconcile } from '@/features/transactions/api/use-can-reconcile';
import { useDeleteTransaction } from '@/features/transactions/api/use-delete-transaction';
import { useGetDocuments } from '@/features/transactions/api/use-documents';
import { useEditTransaction } from '@/features/transactions/api/use-edit-transaction';
import { useGetSplitGroup } from '@/features/transactions/api/use-get-split-group';
import { useGetStatusHistory } from '@/features/transactions/api/use-get-status-history';
import { useGetTransaction } from '@/features/transactions/api/use-get-transaction';
import { useSplitTransaction } from '@/features/transactions/api/use-split-transaction';
import { useUncompleteTransaction } from '@/features/transactions/api/use-uncomplete-transaction';
import { useUnreconcileTransaction } from '@/features/transactions/api/use-unreconcile-transaction';
import { useNewTransaction } from '@/features/transactions/hooks/use-new-transaction';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { useConfirm } from '@/hooks/use-confirm';
import { client } from '@/lib/hono';
import { convertAmountToMiliunits, formatCurrency } from '@/lib/utils';

import {
    type SplitTransactionData,
    UnifiedEditTransactionForm,
    type UnifiedEditTransactionFormValues,
} from './unified-edit-transaction-form';

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;

type StatusHistoryEntry = {
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    changedAt?: string | Date | null;
    changedBy?: string | null;
    notes?: string | null;
};

const STATUS_ORDER: Record<
    'draft' | 'pending' | 'completed' | 'reconciled',
    number
> = {
    draft: 0,
    pending: 1,
    completed: 2,
    reconciled: 3,
};

export const EditTransactionSheet = () => {
    const {
        isOpen,
        onClose,
        id,
        initialTab,
        tab,
        setTab,
        onOpen: onOpenTransaction,
    } = useOpenTransaction();
    const { onOpen: onOpenNew } = useNewTransaction();

    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this transaction.',
    );

    const transactionQuery = useGetTransaction(id);
    const statusHistoryQuery = useGetStatusHistory(id);
    const splitGroupQuery = useGetSplitGroup(
        transactionQuery.data?.splitGroupId,
    );
    const isSplitParent = transactionQuery.data?.splitType === 'parent';
    const splitGroupTransactions = splitGroupQuery.data ?? [];
    const splitChildren = useMemo(
        () =>
            splitGroupTransactions.filter(
                (transaction) => transaction.splitType === 'child',
            ),
        [splitGroupTransactions],
    );
    const canReconcileQuery = useCanReconcile(id);
    const editMutation = useEditTransaction(id);
    const splitMutation = useSplitTransaction(id);
    const deleteMutation = useDeleteTransaction(id);
    const unreconcileMutation = useUnreconcileTransaction(id);
    const uncompleteMutation = useUncompleteTransaction(id);

    // Document validation queries
    const documentsQuery = useGetDocuments(isSplitParent ? '' : (id ?? ''));
    const settingsQuery = useGetSettings();

    const tagMutation = useCreateTag();
    const tagQuery = useGetTags();
    const tagOptions = (tagQuery.data ?? []).map((tag) => ({
        label: tag.name,
        value: tag.id,
        color: tag.color,
    }));

    const accountMutation = useCreateAccount();
    const customerMutation = useCreateCustomer();

    const onCreateTag = (name: string) => tagMutation.mutate({ name });
    const onCreateCustomer = (name: string) =>
        customerMutation.mutateAsync({ name }).then((response) => {
            if ('data' in response) {
                return response.data.id;
            }

            throw new Error(response.error ?? 'Failed to create customer.');
        });

    const isPending =
        editMutation.isPending ||
        splitMutation.isPending ||
        deleteMutation.isPending ||
        unreconcileMutation.isPending ||
        uncompleteMutation.isPending ||
        transactionQuery.isLoading ||
        tagMutation.isPending ||
        accountMutation.isPending ||
        customerMutation.isPending;

    const isLoading = transactionQuery.isLoading || tagQuery.isLoading;

    const onSubmit = (values: UnifiedEditTransactionFormValues) => {
        const autoDraftToPending =
            settingsQuery.data?.autoDraftToPending ?? false;
        const doubleEntryMode = settingsQuery.data?.doubleEntryMode ?? false;

        const existingPayee = transactionQuery.data?.payee ?? null;
        const nextPayeeCustomerId = values.payeeCustomerId || null;
        const nextPayee = nextPayeeCustomerId ? null : existingPayee;

        const shouldAutoPromoteDraftToPending =
            autoDraftToPending &&
            currentStatus === 'draft' &&
            !!(nextPayee || nextPayeeCustomerId) &&
            (!doubleEntryMode ||
                (!!values.creditAccountId && !!values.debitAccountId));

        // Convert to FormValues format expected by the API
        const formValues: FormValues & { tagIds?: string[] } = {
            date: values.date,
            creditAccountId: values.creditAccountId,
            debitAccountId: values.debitAccountId,
            payeeCustomerId: values.payeeCustomerId || null,
            payee: nextPayee,
            amount: convertAmountToMiliunits(parseFloat(values.amount)),
            notes: values.notes || null,
            status: shouldAutoPromoteDraftToPending ? 'pending' : currentStatus,
            tagIds: values.tagIds,
        };

        editMutation.mutate(formValues);
    };

    const onAdvanceStatus = async (
        nextStatus: 'draft' | 'pending' | 'completed' | 'reconciled',
    ) => {
        if (!transactionQuery.data) return;

        const { splitType, amount, ...transactionData } = transactionQuery.data;

        await editMutation.mutateAsync({
            ...transactionData,
            // Convert amount back to miliunits since useGetTransaction converts it from miliunits
            amount: convertAmountToMiliunits(amount),
            status: nextStatus,
            splitType:
                splitType === 'parent' || splitType === 'child'
                    ? splitType
                    : undefined,
        });
    };

    const onUnreconcile = async (reason: string) => {
        if (!transactionQuery.data) return;
        await unreconcileMutation.mutateAsync({ reason });
    };

    const onUncomplete = async (reason: string) => {
        if (!transactionQuery.data) return;
        await uncompleteMutation.mutateAsync({ reason });
    };

    const onSplit = async (data: SplitTransactionData) => {
        if (!transactionQuery.data) return;
        await splitMutation.mutateAsync(data, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    const defaultValuesForForm: Partial<UnifiedEditTransactionFormValues> =
        transactionQuery.data
            ? {
                  creditAccountId: transactionQuery.data.creditAccountId ?? '',
                  debitAccountId: transactionQuery.data.debitAccountId ?? '',
                  tagIds:
                      transactionQuery.data.tags?.map(
                          (t: { id: string }) => t.id,
                      ) ?? [],
                  amount: String(transactionQuery.data.amount),
                  date: transactionQuery.data.date
                      ? new Date(transactionQuery.data.date)
                      : new Date(),
                  payeeCustomerId:
                      transactionQuery.data.payeeCustomerId ?? undefined,
                  notes: transactionQuery.data.notes ?? undefined,
                  status: (transactionQuery.data.status ?? 'pending') as
                      | 'draft'
                      | 'pending'
                      | 'completed'
                      | 'reconciled',
              }
            : {
                  creditAccountId: '',
                  debitAccountId: '',
                  tagIds: [],
                  amount: '0',
                  date: new Date(),
                  payeeCustomerId: undefined,
                  notes: undefined,
              };

    const currentStatus = (transactionQuery.data?.status ?? 'pending') as
        | 'draft'
        | 'pending'
        | 'completed'
        | 'reconciled';

    // Derive status from children for split parents.
    // Note: A split parent with zero children is an invalid state (should have at least one child).
    // In this edge case, we fall back to currentStatus to avoid UI issues.
    const derivedStatus = useMemo(() => {
        if (splitChildren.length === 0) return currentStatus;
        return splitChildren.reduce(
            (lowest, child) => {
                const nextStatus =
                    (child.status as typeof currentStatus) ?? 'pending';
                return STATUS_ORDER[nextStatus] < STATUS_ORDER[lowest]
                    ? nextStatus
                    : lowest;
            },
            'reconciled' as typeof currentStatus,
        );
    }, [currentStatus, splitChildren]);

    const displayStatus = isSplitParent ? derivedStatus : currentStatus;

    const splitCustomers = useMemo(() => {
        const customers = new Set<string>();
        for (const child of splitChildren) {
            const name = child.payeeCustomerName || child.payee;
            if (name) customers.add(name);
        }
        return [...customers];
    }, [splitChildren]);

    const splitCustomerLabel = splitCustomers.length
        ? `${splitCustomers[0]}${
              splitCustomers.length > 1
                  ? ` +${splitCustomers.length - 1} more`
                  : ''
          }`
        : '—';

    const totalSplitAmount = useMemo(
        () =>
            splitChildren.reduce((sum, child) => sum + (child.amount ?? 0), 0),
        [splitChildren],
    );

    // Only create query objects when this is actually a split parent to avoid
    // unnecessary query instance creation on every render
    const childHistoryQueries = useQueries({
        queries: isSplitParent
            ? splitChildren.map((child) => ({
                  queryKey: ['transaction-status-history', { id: child.id }],
                  queryFn: async (): Promise<StatusHistoryEntry[]> => {
                      const response = await client.api.transactions[':id'][
                          'status-history'
                      ].$get({
                          param: { id: child.id },
                      });

                      if (!response.ok) {
                          throw new Error(
                              'Failed to fetch transaction status history.',
                          );
                      }

                      const { data } = await response.json();
                      return data;
                  },
              }))
            : [],
    });

    // Only create query objects when this is actually a split parent to avoid
    // unnecessary query instance creation on every render
    const childDocumentQueries = useQueries({
        queries: isSplitParent
            ? splitChildren.map((child) => ({
                  queryKey: ['documents', child.id],
                  queryFn: async () => {
                      const response = await client.api.documents.transaction[
                          ':transactionId'
                      ].$get({
                          param: { transactionId: child.id },
                      });

                      if (!response.ok) {
                          throw new Error('Failed to fetch documents');
                      }

                      const { data } = await response.json();
                      return data;
                  },
              }))
            : [],
    });

    const totalSplitDocuments = childDocumentQueries.reduce(
        (sum, query) => sum + (query.data?.length ?? 0),
        0,
    );

    const statusColors: Record<typeof currentStatus, string> = {
        draft: 'text-muted-foreground',
        pending: 'text-yellow-600',
        completed: 'text-blue-600',
        reconciled: 'text-green-600',
    };

    const formatStatusLabel = (status?: string | null) =>
        status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';

    const transactionDateLabel = transactionQuery.data?.date
        ? new Date(transactionQuery.data.date).toLocaleDateString()
        : '—';

    const splitCreatedAt = useMemo(() => {
        if (!statusHistoryQuery.data || statusHistoryQuery.data.length === 0) {
            return transactionQuery.data?.date;
        }
        const oldestEntry =
            statusHistoryQuery.data[statusHistoryQuery.data.length - 1];
        return oldestEntry?.changedAt ?? transactionQuery.data?.date;
    }, [statusHistoryQuery.data, transactionQuery.data?.date]);

    const formatDateTime = (value?: string | Date | null) =>
        value ? new Date(value).toLocaleString() : '—';

    const renderStatusHistory = (history: StatusHistoryEntry[]) => {
        if (!history || history.length === 0) {
            return (
                <div className="text-sm text-muted-foreground">
                    No status history yet.
                </div>
            );
        }

        return (
            <div className="space-y-2 text-sm text-muted-foreground">
                {history.map((entry, idx) => (
                    <Fragment key={entry.id}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                                <UserAvatar
                                    userId={entry.changedBy || 'unknown'}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-foreground">
                                        {entry.fromStatus && (
                                            <span className="text-muted-foreground">
                                                {entry.fromStatus} →{' '}
                                            </span>
                                        )}
                                        {entry.toStatus}
                                    </div>
                                    {!!entry.notes && (
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {entry.notes}
                                        </div>
                                    )}
                                    <div className="text-xs">
                                        {formatDateTime(entry.changedAt)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {idx < history.length - 1 && (
                            <div className="h-px bg-muted" />
                        )}
                    </Fragment>
                ))}
            </div>
        );
    };

    const reconciliationStatus = canReconcileQuery.data;
    const canReconcile = reconciliationStatus?.isReconciled ?? false;
    const reconciliationBlockers: string[] = [];

    // Calculate document requirement status from settings
    const documents = documentsQuery.data ?? [];
    const requiredDocTypeIds: string[] =
        settingsQuery.data?.requiredDocumentTypeIds ?? [];
    const minRequiredDocuments = settingsQuery.data?.minRequiredDocuments ?? 0;

    // Count attached required document types
    const attachedRequiredTypeIds = new Set(
        documents
            .filter((doc) => requiredDocTypeIds.includes(doc.documentTypeId))
            .map((doc) => doc.documentTypeId),
    );
    const attachedRequiredTypesCount = attachedRequiredTypeIds.size;

    // Check if document requirements are met
    const hasAllRequiredDocuments = useMemo(() => {
        if (requiredDocTypeIds.length === 0) return true;
        if (minRequiredDocuments === 0) {
            // All required types must be attached
            return attachedRequiredTypesCount >= requiredDocTypeIds.length;
        } else {
            // At least minRequiredDocuments of the required types must be attached
            return (
                attachedRequiredTypesCount >=
                Math.min(minRequiredDocuments, requiredDocTypeIds.length)
            );
        }
    }, [
        requiredDocTypeIds.length,
        attachedRequiredTypesCount,
        minRequiredDocuments,
    ]);

    const onDelete = async () => {
        const ok = await confirm();

        if (ok) {
            deleteMutation.mutate(undefined, {
                onSuccess: () => {
                    onClose();
                },
            });
        }
    };

    const handleDuplicate = () => {
        if (!transactionQuery.data) return;

        // Amount is already converted from milliunits by useGetTransaction
        const amount = transactionQuery.data.amount
            ? Math.abs(transactionQuery.data.amount).toString()
            : '0';

        // Prepare default values for the new transaction form
        const defaultValues = {
            date: new Date(),
            payeeCustomerId: transactionQuery.data.payeeCustomerId ?? '',
            notes: transactionQuery.data.notes ?? '',
            tagIds:
                transactionQuery.data.tags?.map((t: { id: string }) => t.id) ??
                [],
            creditEntries: transactionQuery.data.creditAccountId
                ? [
                      {
                          accountId: transactionQuery.data.creditAccountId,
                          amount,
                          notes: '',
                      },
                  ]
                : [{ accountId: '', amount: '', notes: '' }],
            debitEntries: transactionQuery.data.debitAccountId
                ? [
                      {
                          accountId: transactionQuery.data.debitAccountId,
                          amount,
                          notes: '',
                      },
                  ]
                : [{ accountId: '', amount: '', notes: '' }],
        };

        // Close the edit sheet before opening new transaction sheet
        onClose();
        onOpenNew(defaultValues);
    };

    type TabValue = 'details' | 'documents' | 'history';
    const [activeTab, setActiveTab] = useState<TabValue>(
        tab || initialTab || 'details',
    );

    // Reset tab when sheet opens with a new initial tab
    React.useEffect(() => {
        if (isOpen && (tab || initialTab)) {
            setActiveTab((tab || initialTab) as TabValue);
        }
    }, [isOpen, initialTab, tab]);

    const handleTabChange = (value: string) => {
        const nextTab = value as TabValue;
        setActiveTab(nextTab);
        setTab(nextTab);
    };

    return (
        <>
            <ConfirmDialog />
            <Sheet open={isOpen || isPending} onOpenChange={onClose}>
                <SheetContent className="flex flex-col h-full p-0 max-w-xl lg:max-w-xl overflow-hidden">
                    <div className="px-6 pt-6">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                {displayStatus === 'reconciled'
                                    ? 'Transaction Details'
                                    : 'Edit Transaction'}
                                {transactionQuery.data?.stripePaymentId && (
                                    <Badge
                                        variant="outline"
                                        className="text-xs font-normal"
                                    >
                                        Stripe
                                    </Badge>
                                )}
                            </SheetTitle>
                            <SheetDescription>
                                {displayStatus === 'reconciled'
                                    ? 'View reconciled transaction details.'
                                    : 'Edit an existing transaction.'}
                                {transactionQuery.data?.stripePaymentUrl && (
                                    <a
                                        href={
                                            transactionQuery.data
                                                .stripePaymentUrl
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                        View in Stripe
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </SheetDescription>
                        </SheetHeader>
                    </div>

                    {/* Status Progression */}
                    <div className="px-6">
                        {isSplitParent ? (
                            <div className="rounded-md border p-3">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={
                                            statusColors[displayStatus] || ''
                                        }
                                    >
                                        {formatStatusLabel(displayStatus)}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        Derived from {splitChildren.length}{' '}
                                        split part
                                        {splitChildren.length === 1 ? '' : 's'}.
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <StatusProgression
                                currentStatus={currentStatus}
                                onAdvance={onAdvanceStatus}
                                onUnreconcile={onUnreconcile}
                                onUncomplete={onUncomplete}
                                disabled={isPending}
                                autoDraftToPendingEnabled={
                                    settingsQuery.data?.autoDraftToPending ??
                                    false
                                }
                                canReconcile={canReconcile}
                                reconciliationBlockers={reconciliationBlockers}
                                hasAllRequiredDocuments={
                                    hasAllRequiredDocuments
                                }
                                requiredDocumentTypes={
                                    requiredDocTypeIds.length
                                }
                                attachedRequiredTypes={
                                    attachedRequiredTypesCount
                                }
                                minRequiredDocuments={minRequiredDocuments}
                            />
                        )}
                    </div>

                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Tabs
                            value={activeTab}
                            onValueChange={handleTabChange}
                            className="flex-1 flex flex-col min-h-0"
                        >
                            <div className="px-6 mb-4">
                                <TabsList className="w-full">
                                    <TabsTrigger value="details">
                                        Details
                                    </TabsTrigger>
                                    <TabsTrigger value="documents">
                                        Documents
                                    </TabsTrigger>
                                    <TabsTrigger value="history">
                                        History
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pb-6">
                                <TabsContent
                                    value="details"
                                    className="space-y-6 mt-0"
                                >
                                    {isSplitParent ? (
                                        <div className="space-y-4">
                                            <div className="rounded-md border p-3 space-y-3">
                                                <div className="text-sm font-semibold">
                                                    Split summary
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    This parent only groups
                                                    split parts. Edit parts to
                                                    update amounts, accounts,
                                                    tags, status, and documents.
                                                </div>
                                                <div className="grid gap-2 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Date
                                                        </span>
                                                        <span>
                                                            {
                                                                transactionDateLabel
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Status
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                statusColors[
                                                                    displayStatus
                                                                ] || ''
                                                            }
                                                        >
                                                            {formatStatusLabel(
                                                                displayStatus,
                                                            )}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Customers
                                                        </span>
                                                        <span>
                                                            {splitCustomerLabel}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Total amount
                                                        </span>
                                                        <span>
                                                            {formatCurrency(
                                                                totalSplitAmount,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">
                                                            Parts
                                                        </span>
                                                        <span>
                                                            {
                                                                splitChildren.length
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 rounded-md border p-3">
                                                <div className="text-sm font-semibold">
                                                    Split parts
                                                </div>
                                                {splitChildren.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground">
                                                        No parts found for this
                                                        split group.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 text-sm">
                                                        {splitChildren.map(
                                                            (child) => (
                                                                <div
                                                                    key={
                                                                        child.id
                                                                    }
                                                                    className="flex items-center justify-between gap-3 rounded bg-muted/40 px-2 py-1"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {child.payeeCustomerName ||
                                                                                child.payee ||
                                                                                'Untitled'}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {formatStatusLabel(
                                                                                child.status ??
                                                                                    'pending',
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formatCurrency(
                                                                                child.amount ??
                                                                                    0,
                                                                            )}
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outlined"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                onOpenTransaction(
                                                                                    child.id,
                                                                                )
                                                                            }
                                                                        >
                                                                            Open
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <UnifiedEditTransactionForm
                                                id={id}
                                                defaultValues={
                                                    defaultValuesForForm
                                                }
                                                onSubmit={onSubmit}
                                                onSplit={onSplit}
                                                disabled={isPending}
                                                tagOptions={tagOptions}
                                                onCreateTag={onCreateTag}
                                                onCreateCustomer={
                                                    onCreateCustomer
                                                }
                                                onDelete={onDelete}
                                                payeeText={
                                                    transactionQuery.data?.payee
                                                }
                                                currentStatus={currentStatus}
                                                isSplit={
                                                    !!transactionQuery.data
                                                        ?.splitGroupId
                                                }
                                            />

                                            {splitGroupQuery.data &&
                                                splitGroupQuery.data.length >
                                                    0 && (
                                                    <div className="space-y-2 rounded-md border p-3">
                                                        <div className="text-sm font-semibold">
                                                            Split group
                                                        </div>
                                                        <div className="space-y-1 text-sm">
                                                            {splitGroupQuery.data.map(
                                                                (split) => (
                                                                    <div
                                                                        key={
                                                                            split.id
                                                                        }
                                                                        className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
                                                                    >
                                                                        <div>
                                                                            <div className="font-medium">
                                                                                {split.splitType ===
                                                                                'parent'
                                                                                    ? 'Parent'
                                                                                    : 'Child'}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {split.payeeCustomerName ||
                                                                                    split.payee ||
                                                                                    ''}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {formatCurrency(
                                                                                split.amount ??
                                                                                    0,
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* Duplicate button */}
                                            <div className="pb-4">
                                                <Button
                                                    type="button"
                                                    variant="outlined"
                                                    onClick={handleDuplicate}
                                                    disabled={
                                                        isPending ||
                                                        !transactionQuery.data
                                                    }
                                                    className="w-full"
                                                >
                                                    <Copy className="mr-2 size-4" />
                                                    Duplicate Transaction
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="documents" className="mt-0">
                                    {isSplitParent ? (
                                        <div className="space-y-4">
                                            <div className="rounded-md border p-3 space-y-2">
                                                <div className="text-sm font-semibold">
                                                    Documents
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Documents are stored on
                                                    split parts. Open a part to
                                                    manage its documents.
                                                </div>
                                                <div className="text-sm">
                                                    {totalSplitDocuments}{' '}
                                                    document
                                                    {totalSplitDocuments === 1
                                                        ? ''
                                                        : 's'}{' '}
                                                    across{' '}
                                                    {splitChildren.length} part
                                                    {splitChildren.length === 1
                                                        ? ''
                                                        : 's'}
                                                    .
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {splitChildren.map(
                                                    (child, index) => {
                                                        const docsQuery =
                                                            childDocumentQueries[
                                                                index
                                                            ];
                                                        const count =
                                                            docsQuery?.data
                                                                ?.length ?? 0;
                                                        return (
                                                            <div
                                                                key={child.id}
                                                                className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
                                                            >
                                                                <div>
                                                                    <div className="text-sm font-medium">
                                                                        {child.payeeCustomerName ||
                                                                            child.payee ||
                                                                            'Untitled'}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {docsQuery?.isLoading
                                                                            ? 'Loading documents...'
                                                                            : `${count} document${count === 1 ? '' : 's'}`}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outlined"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        onOpenTransaction(
                                                                            child.id,
                                                                            'documents',
                                                                        )
                                                                    }
                                                                >
                                                                    Open
                                                                </Button>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        transactionQuery.data && (
                                            <DocumentsTab
                                                transactionId={
                                                    transactionQuery.data.id
                                                }
                                                readOnly={
                                                    displayStatus ===
                                                    'reconciled'
                                                }
                                            />
                                        )
                                    )}
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    {isSplitParent ? (
                                        <div className="space-y-4">
                                            <div className="rounded-md border p-3">
                                                <div className="text-sm font-semibold">
                                                    Split created
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatDateTime(
                                                        splitCreatedAt ?? null,
                                                    )}
                                                </div>
                                            </div>
                                            {splitChildren.map(
                                                (child, index) => {
                                                    const historyQuery =
                                                        childHistoryQueries[
                                                            index
                                                        ];
                                                    const history =
                                                        historyQuery?.data ??
                                                        [];
                                                    return (
                                                        <div
                                                            key={child.id}
                                                            className="space-y-2 rounded-md border p-3"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-semibold">
                                                                        {child.payeeCustomerName ||
                                                                            child.payee ||
                                                                            'Untitled'}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        Part{' '}
                                                                        {index +
                                                                            1}{' '}
                                                                        ·{' '}
                                                                        {formatCurrency(
                                                                            child.amount ??
                                                                                0,
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outlined"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        onOpenTransaction(
                                                                            child.id,
                                                                            'history',
                                                                        )
                                                                    }
                                                                >
                                                                    Open
                                                                </Button>
                                                            </div>
                                                            {historyQuery?.isLoading ? (
                                                                <div className="text-sm text-muted-foreground">
                                                                    Loading
                                                                    history...
                                                                </div>
                                                            ) : (
                                                                renderStatusHistory(
                                                                    history,
                                                                )
                                                            )}
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 rounded-md border p-3">
                                            <div className="text-sm font-semibold">
                                                Status history
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Created:{' '}
                                                {formatDateTime(
                                                    statusHistoryQuery.data?.[
                                                        statusHistoryQuery.data
                                                            .length - 1
                                                    ]?.changedAt ?? null,
                                                )}
                                            </div>
                                            {renderStatusHistory(
                                                statusHistoryQuery.data ?? [],
                                            )}
                                        </div>
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
};
