'use client';

import { ChevronRight, Lock, Plus, Split, Trash, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { AccountSelect } from '@/components/account-select';
import { AmountInput } from '@/components/amount-input';
import { CustomerSelect } from '@/components/customer-select';
import { DatePicker } from '@/components/date-picker';
import {
    type QuickAssignSuggestion,
    QuickAssignSuggestions,
} from '@/components/quick-assign-suggestions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SheetFooter } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { useGetSuggestedTags } from '@/features/tags/api/use-get-suggested-tags';
import { TagMultiSelect } from '@/features/tags/components/tag-multi-select';
import { useGetSuggestedAccounts } from '@/features/transactions/api/use-get-suggested-accounts';
import { useGetSuggestedCustomers } from '@/features/transactions/api/use-get-suggested-customers';

import { AMOUNT_TOLERANCE, cn } from '@/lib/utils';

// Types for split entries
type SplitEntry = {
    id: string;
    creditAccountId: string;
    debitAccountId: string;
    amount: string;
    notes?: string;
};

export type UnifiedEditTransactionFormValues = {
    date: Date;
    creditAccountId?: string;
    debitAccountId?: string;
    amount: string;
    payeeCustomerId?: string;
    tagIds?: string[];
    notes?: string;
    status?: 'draft' | 'pending' | 'completed' | 'reconciled';
};

export type SplitTransactionData = {
    splits: Array<{
        amount: number;
        creditAccountId?: string;
        debitAccountId?: string;
        notes?: string;
    }>;
};

type Props = {
    id?: string;
    disabled?: boolean;
    tagOptions: { label: string; value: string; color?: string | null }[];
    onCreateTag: (name: string) => void;
    onCreateCustomer: (name: string) => Promise<string | undefined>;
    onSubmit: (values: UnifiedEditTransactionFormValues) => void;
    onSplit?: (data: SplitTransactionData) => void;
    onDelete?: () => void;
    defaultValues?: Partial<UnifiedEditTransactionFormValues>;
    /** Raw payee text (when customer is not matched) */
    payeeText?: string | null;
    /** Current transaction status - used for conditional validation and field disabling */
    currentStatus?: 'draft' | 'pending' | 'completed' | 'reconciled';
    /** Whether this transaction is already split */
    isSplit?: boolean;
};

export const UnifiedEditTransactionForm = ({
    id,
    disabled,
    tagOptions,
    onCreateTag,
    onCreateCustomer,
    onSubmit,
    onSplit,
    onDelete,
    defaultValues,
    payeeText,
    currentStatus = 'draft',
    isSplit = false,
}: Props) => {
    // Form state
    const [date, setDate] = useState<Date>(defaultValues?.date ?? new Date());
    const [creditAccountId, setCreditAccountId] = useState(
        defaultValues?.creditAccountId ?? '',
    );
    const [debitAccountId, setDebitAccountId] = useState(
        defaultValues?.debitAccountId ?? '',
    );
    const [amount, setAmount] = useState(defaultValues?.amount ?? '0');
    const [payeeCustomerId, _setPayeeCustomerId] = useState(
        defaultValues?.payeeCustomerId ?? '',
    );
    const setPayeeCustomerId = (value: string) => {
        console.trace('setPayeeCustomerId', value);
        _setPayeeCustomerId(value);
    };
    const [tagIds, setTagIds] = useState<string[]>(defaultValues?.tagIds ?? []);
    const [notes, setNotes] = useState(defaultValues?.notes ?? '');

    // Split mode state
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [splitEntries, setSplitEntries] = useState<SplitEntry[]>([
        {
            id: '1',
            creditAccountId: defaultValues?.creditAccountId ?? '',
            debitAccountId: defaultValues?.debitAccountId ?? '',
            amount: defaultValues?.amount ?? '0',
            notes: '',
        },
        {
            id: '2',
            creditAccountId: '',
            debitAccountId: '',
            amount: '0',
            notes: '',
        },
    ]);

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);

    // Fetch customers list for quick-assign display
    const { data: customers } = useGetCustomers();

    // Fetch accounts list for quick-assign display
    const { data: accounts } = useGetAccounts({ pageSize: 9999 });

    // Use either current value or default value for notes
    const effectiveNotes = notes || defaultValues?.notes || '';

    // Customer suggestions - fetch when customer is not set and we have payee text or notes
    const shouldFetchCustomerSuggestions =
        !payeeCustomerId && (!!payeeText || !!effectiveNotes);
    const suggestedCustomersQuery = useGetSuggestedCustomers(
        payeeText ?? '',
        effectiveNotes,
        {
            enabled: shouldFetchCustomerSuggestions,
        },
    );

    // Account suggestions - fetch when customer is selected but accounts are not set
    const effectiveCustomerId =
        payeeCustomerId || defaultValues?.payeeCustomerId || '';
    const effectiveCreditAccountId =
        creditAccountId || defaultValues?.creditAccountId || '';
    const effectiveDebitAccountId =
        debitAccountId || defaultValues?.debitAccountId || '';
    const effectiveTagIds =
        tagIds.length > 0 ? tagIds : (defaultValues?.tagIds ?? []);

    const shouldFetchAccountSuggestions =
        !!effectiveCustomerId &&
        (!effectiveCreditAccountId || !effectiveDebitAccountId);
    const suggestedAccountsQuery = useGetSuggestedAccounts(
        effectiveCustomerId,
        {
            enabled: shouldFetchAccountSuggestions || isAccountSelectOpen,
        },
    );
    const suggestedCreditAccountIds = useMemo(
        () =>
            suggestedAccountsQuery.data?.credit.map(
                (suggestion) => suggestion.accountId,
            ) ?? [],
        [suggestedAccountsQuery.data?.credit],
    );
    const suggestedDebitAccountIds = useMemo(
        () =>
            suggestedAccountsQuery.data?.debit.map(
                (suggestion) => suggestion.accountId,
            ) ?? [],
        [suggestedAccountsQuery.data?.debit],
    );

    // Tag suggestions - fetch when customer is selected but no tags set
    const shouldFetchTagSuggestions =
        !!effectiveCustomerId && effectiveTagIds.length === 0;
    const suggestedTagsQuery = useGetSuggestedTags(
        shouldFetchTagSuggestions || isTagMenuOpen
            ? effectiveCustomerId
            : undefined,
    );
    const suggestedTagIds = useMemo(
        () =>
            suggestedTagsQuery.data?.map((suggestion) => suggestion.tagId) ??
            [],
        [suggestedTagsQuery.data],
    );

    // Quick-assign suggestions for customer
    const customerQuickAssignSuggestions = useMemo<
        QuickAssignSuggestion[]
    >(() => {
        if (!suggestedCustomersQuery.data || effectiveCustomerId) return [];
        return suggestedCustomersQuery.data
            .slice(0, 3)
            .map((suggestion) => {
                const customer = customers?.find(
                    (c) => c.id === suggestion.customerId,
                );
                return {
                    id: suggestion.customerId,
                    label: customer?.name ?? 'Unknown',
                };
            })
            .filter((s) => s.label !== 'Unknown');
    }, [suggestedCustomersQuery.data, customers, effectiveCustomerId]);

    // Quick-assign suggestions for credit account
    const creditAccountQuickAssignSuggestions = useMemo<
        QuickAssignSuggestion[]
    >(() => {
        if (effectiveCreditAccountId || !suggestedCreditAccountIds.length)
            return [];
        return suggestedCreditAccountIds.slice(0, 3).map((accountId) => {
            const account = accounts?.find((a) => a.id === accountId);
            return {
                id: accountId,
                label: account
                    ? `${account.code ? `${account.code} - ` : ''}${account.name}`
                    : 'Unknown',
            };
        });
    }, [suggestedCreditAccountIds, accounts, effectiveCreditAccountId]);

    // Quick-assign suggestions for debit account
    const debitAccountQuickAssignSuggestions = useMemo<
        QuickAssignSuggestion[]
    >(() => {
        if (effectiveDebitAccountId || !suggestedDebitAccountIds.length)
            return [];
        return suggestedDebitAccountIds.slice(0, 3).map((accountId) => {
            const account = accounts?.find((a) => a.id === accountId);
            return {
                id: accountId,
                label: account
                    ? `${account.code ? `${account.code} - ` : ''}${account.name}`
                    : 'Unknown',
            };
        });
    }, [suggestedDebitAccountIds, accounts, effectiveDebitAccountId]);

    // Quick-assign suggestions for tags
    const tagQuickAssignSuggestions = useMemo<QuickAssignSuggestion[]>(() => {
        if (effectiveTagIds.length > 0 || !suggestedTagIds.length) return [];
        return suggestedTagIds.slice(0, 3).map((tagId) => {
            const tag = tagOptions.find((t) => t.value === tagId);
            return {
                id: tagId,
                label: tag?.label ?? 'Unknown',
            };
        });
    }, [suggestedTagIds, tagOptions, effectiveTagIds]);

    const resolvedTagOptions = useMemo(() => {
        if (suggestedTagIds.length === 0) {
            return tagOptions;
        }

        const suggestedIdSet = new Set(suggestedTagIds);
        const suggested = tagOptions
            .filter((option) => suggestedIdSet.has(option.value))
            .map((option) => ({ ...option, suggested: true }));
        const remaining = tagOptions.filter(
            (option) => !suggestedIdSet.has(option.value),
        );

        return [...suggested, ...remaining];
    }, [tagOptions, suggestedTagIds]);

    // Split mode calculations
    const splitTotal = useMemo(
        () =>
            splitEntries.reduce(
                (sum, entry) => sum + parseFloat(entry.amount || '0'),
                0,
            ),
        [splitEntries],
    );

    const originalAmount = parseFloat(amount || '0');
    const isSplitBalanced = Math.abs(splitTotal - originalAmount) < AMOUNT_TOLERANCE;

    // Split handlers
    const handleAddSplitEntry = () => {
        setSplitEntries((prev) => [
            ...prev,
            {
                id: `${Date.now()}`,
                creditAccountId: creditAccountId, // Preserve parent credit account
                debitAccountId: '',
                amount: '0',
                notes: '',
            },
        ]);
    };

    const handleRemoveSplitEntry = (index: number) => {
        if (splitEntries.length <= 2) return;
        setSplitEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpdateSplitEntry = (
        index: number,
        field: keyof SplitEntry,
        value: string,
    ) => {
        setSplitEntries((prev) =>
            prev.map((entry, i) =>
                i === index ? { ...entry, [field]: value } : entry,
            ),
        );
    };

    const handleToggleSplitMode = () => {
        if (isSplitMode) {
            // Cancel split mode
            setIsSplitMode(false);
            // Reset split entries
            setSplitEntries([
                {
                    id: '1',
                    creditAccountId: creditAccountId,
                    debitAccountId: debitAccountId,
                    amount: amount,
                    notes: '',
                },
                {
                    id: '2',
                    creditAccountId: '',
                    debitAccountId: '',
                    amount: '0',
                    notes: '',
                },
            ]);
        } else {
            // Enter split mode
            setIsSplitMode(true);
        }
    };

    const handleSplitSubmit = () => {
        // Validate all splits
        const newErrors: Record<string, string> = {};

        splitEntries.forEach((entry, index) => {
            if (!entry.creditAccountId) {
                newErrors[`splitEntries.${index}.creditAccountId`] =
                    'Select credit account';
            }
            if (!entry.debitAccountId) {
                newErrors[`splitEntries.${index}.debitAccountId`] =
                    'Select debit account';
            }
            if (!entry.amount || entry.amount === '0') {
                newErrors[`splitEntries.${index}.amount`] = 'Enter an amount';
            }
        });

        if (!isSplitBalanced) {
            newErrors.splitBalance = `Split amounts (${splitTotal.toFixed(2)}) must equal original amount (${originalAmount.toFixed(2)})`;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Call onSplit callback
        if (onSplit) {
            onSplit({
                splits: splitEntries.map((entry) => ({
                    amount: Math.round(parseFloat(entry.amount) * 1000), // Convert to miliunits (1000x)
                    creditAccountId: entry.creditAccountId,
                    debitAccountId: entry.debitAccountId,
                    notes: entry.notes || undefined,
                })),
            });
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!amount || amount === '0') {
            newErrors.amount = 'Enter an amount';
        }

        // For non-draft transactions, require both accounts
        if (currentStatus !== 'draft') {
            if (!creditAccountId) {
                newErrors.creditAccountId = 'Select credit account';
            }
            if (!debitAccountId) {
                newErrors.debitAccountId = 'Select debit account';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onSubmit({
            date,
            creditAccountId: creditAccountId || undefined,
            debitAccountId: debitAccountId || undefined,
            amount,
            payeeCustomerId: payeeCustomerId || undefined,
            tagIds: tagIds.length > 0 ? tagIds : undefined,
            notes: notes || undefined,
        });
    };

    // Check if transaction is reconciled (fully locked)
    const isReconciled = currentStatus === 'reconciled';
    // Check if transaction is completed (lock financial fields)
    const isCompleted = currentStatus === 'completed';

    // Determine which fields should be disabled
    const isPending = disabled || isReconciled;
    const isFinancialFieldsLocked = isCompleted || isReconciled;

    return (
        <form
            onSubmit={handleSubmit}
            autoCapitalize="off"
            autoComplete="off"
            className="space-y-6"
        >
            {/* Status-based alerts */}
            {isCompleted && !isReconciled && (
                <Alert>
                    <Lock className="size-4" />
                    <AlertDescription>
                        This transaction is completed. Accounts, amount, date,
                        and customer cannot be changed.
                    </AlertDescription>
                </Alert>
            )}

            {/* Date and Customer Section */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label>Date</Label>
                    <DatePicker
                        value={date}
                        onChange={(newDate) => newDate && setDate(newDate)}
                        disabled={isFinancialFieldsLocked}
                    />
                </div>

                <div className="space-y-2">
                    <Label>
                        Customer{' '}
                        {isFinancialFieldsLocked && (
                            <Lock className="inline h-3 w-3 ml-1" />
                        )}
                    </Label>
                    <CustomerSelect
                        value={payeeCustomerId}
                        onChange={(value) => setPayeeCustomerId(value ?? '')}
                        disabled={isFinancialFieldsLocked}
                        placeholder="Select customer..."
                        onCreate={onCreateCustomer}
                        suggestionQuery={payeeText ?? ''}
                        suggestionNotes={notes ?? ''}
                    />
                    {!payeeCustomerId && (
                        <QuickAssignSuggestions
                            suggestions={customerQuickAssignSuggestions}
                            isLoading={
                                shouldFetchCustomerSuggestions &&
                                suggestedCustomersQuery.isLoading
                            }
                            onSelect={setPayeeCustomerId}
                            disabled={isFinancialFieldsLocked}
                        />
                    )}
                    {payeeText && !payeeCustomerId && (
                        <p className="text-xs text-amber-600 mt-1">
                            Imported payee:{' '}
                            <span className="font-medium">{payeeText}</span>
                        </p>
                    )}
                </div>
            </div>

            <hr />

            {/* Transaction Entry Section - Credit | Amount | Debit */}
            <div className="grid grid-cols-[2fr_16px_minmax(min-content,1fr)_16px_2fr] items-start gap-1">
                {/* Credit Account */}
                <div className="space-y-1">
                    <AccountSelect
                        value={creditAccountId}
                        onChange={setCreditAccountId}
                        disabled={isFinancialFieldsLocked}
                        placeholder="Credit account..."
                        excludeReadOnly
                        allowedTypes={['credit', 'neutral']}
                        suggestedAccountIds={suggestedCreditAccountIds}
                        onOpenChange={setIsAccountSelectOpen}
                    />
                    {!creditAccountId && effectiveCustomerId && (
                        <QuickAssignSuggestions
                            suggestions={creditAccountQuickAssignSuggestions}
                            isLoading={
                                shouldFetchAccountSuggestions &&
                                suggestedAccountsQuery.isLoading
                            }
                            onSelect={setCreditAccountId}
                            disabled={isFinancialFieldsLocked}
                        />
                    )}
                    {errors.creditAccountId && (
                        <p className="text-sm font-medium text-destructive">
                            {errors.creditAccountId}
                        </p>
                    )}
                </div>

                <ChevronRight className="size-4 opacity-60 mt-2.5" />

                {/* Amount Column */}
                <div className="space-y-1">
                    <AmountInput
                        value={amount}
                        onChange={(value) => setAmount(value ?? '')}
                        disabled={isFinancialFieldsLocked}
                        placeholder="0.00"
                        hideSign
                    />
                    {errors.amount && (
                        <p className="text-sm font-medium text-destructive">
                            {errors.amount}
                        </p>
                    )}
                </div>

                <ChevronRight className="size-4 opacity-60 mt-2.5" />

                {/* Debit Account */}
                <div className="space-y-1">
                    <AccountSelect
                        value={debitAccountId}
                        onChange={setDebitAccountId}
                        disabled={isFinancialFieldsLocked}
                        placeholder="Debit account..."
                        excludeReadOnly
                        allowedTypes={['debit', 'neutral']}
                        suggestedAccountIds={suggestedDebitAccountIds}
                        onOpenChange={setIsAccountSelectOpen}
                    />
                    {!debitAccountId && effectiveCustomerId && (
                        <QuickAssignSuggestions
                            suggestions={debitAccountQuickAssignSuggestions}
                            isLoading={
                                shouldFetchAccountSuggestions &&
                                suggestedAccountsQuery.isLoading
                            }
                            onSelect={setDebitAccountId}
                            disabled={isFinancialFieldsLocked}
                        />
                    )}
                    {errors.debitAccountId && (
                        <p className="text-sm font-medium text-destructive">
                            {errors.debitAccountId}
                        </p>
                    )}
                </div>
            </div>

            {/* Split Button - Only show if not already split and not in split mode */}
            {!isSplit &&
                !isSplitMode &&
                !isFinancialFieldsLocked &&
                onSplit && (
                    <div className="flex justify-center">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleToggleSplitMode}
                            disabled={isPending || !amount || amount === '0'}
                        >
                            <Split className="h-4 w-4 mr-2" />
                            Split Transaction
                        </Button>
                    </div>
                )}

            {/* Split UI - Show when in split mode */}
            {isSplitMode && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex">
                            <Split className="h-4 w-4 mr-2" />
                            <h3 className="text-sm font-semibold">
                            Split Transaction
                        </h3>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleSplitMode}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                    </div>

                    {/* Split Entries */}
                    <div className='space-y-2'>
                        {splitEntries.map((entry, index) => (
                            <Fragment key={entry.id}>
                                                                {splitEntries.length > 2 && (
                                                                    <div className="flex justify-end mt-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() =>
                                                handleRemoveSplitEntry(index)
                                            }
                                            disabled={isPending}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                        </div>
                                    )}
                            <div
                                className="rounded-md border p-2 bg-background space-y-2"
                            >
                                {/* Credit and Debit accounts */}
                                <div className="grid grid-cols-[2fr_auto_1fr_auto_2fr] gap-2 items-start">
                                    <div className="space-y-1">
                                        <AccountSelect
                                            value={entry.creditAccountId}
                                            onChange={(value) =>
                                                handleUpdateSplitEntry(
                                                    index,
                                                    'creditAccountId',
                                                    value,
                                                )
                                            }
                                            disabled={isPending}
                                            placeholder="Credit..."
                                            excludeReadOnly
                                            allowedTypes={['credit', 'neutral']}
                                        />
                                        {errors[
                                            `splitEntries.${index}.creditAccountId`
                                        ] && (
                                            <p className="text-xs font-medium text-destructive">
                                                {
                                                    errors[
                                                        `splitEntries.${index}.creditAccountId`
                                                    ]
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <ChevronRight className="size-4 opacity-60 mt-3 shrink-0" />

                                {/* Amount */}
                                <div className="space-y-1">
                                    <AmountInput
                                        value={entry.amount}
                                        onChange={(value) =>
                                            handleUpdateSplitEntry(
                                                index,
                                                'amount',
                                                value ?? '',
                                            )
                                        }
                                        disabled={isPending}
                                        placeholder="0.00"
                                        hideSign
                                    />
                                    {errors[`splitEntries.${index}.amount`] && (
                                        <p className="text-xs font-medium text-destructive">
                                            {
                                                errors[
                                                    `splitEntries.${index}.amount`
                                                ]
                                            }
                                        </p>
                                    )}
                                </div>

                                                                    <ChevronRight className="size-4 opacity-60 mt-3 shrink-0" />

                                    <div className="space-y-1">
                                        <AccountSelect
                                            value={entry.debitAccountId}
                                            onChange={(value) =>
                                                handleUpdateSplitEntry(
                                                    index,
                                                    'debitAccountId',
                                                    value,
                                                )
                                            }
                                            disabled={isPending}
                                            placeholder="Debit..."
                                            excludeReadOnly
                                            allowedTypes={['debit', 'neutral']}
                                        />
                                        {errors[
                                            `splitEntries.${index}.debitAccountId`
                                        ] && (
                                            <p className="text-xs font-medium text-destructive">
                                                {
                                                    errors[
                                                        `splitEntries.${index}.debitAccountId`
                                                    ]
                                                }
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Notes (Optional) */}
                                <div className="space-y-1">
                                    <Label className="text-xs">
                                        Notes (Optional)
                                    </Label>
                                    <Textarea
                                        value={entry.notes}
                                        onChange={(e) =>
                                            handleUpdateSplitEntry(
                                                index,
                                                'notes',
                                                e.target.value,
                                            )
                                        }
                                        disabled={isPending}
                                        placeholder="Optional notes for this split..."
                                        className="h-16 text-xs"
                                    />
                                </div>
                            </div>
                            </Fragment>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={handleAddSplitEntry}
                            disabled={isPending}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Split
                        </Button>
                    </div>

                    {/* Split Summary */}
                    <div
                        className={cn(
                            'rounded-md border p-3 space-y-1',
                            isSplitBalanced
                                ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                                : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
                        )}
                    >
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">Summary</span>
                            {isSplitBalanced ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                    ✓ Balanced
                                </span>
                            ) : (
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                    ⚠ Unbalanced
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    Original:
                                </span>
                                <span className="font-mono font-medium">
                                    {originalAmount.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    Split Total:
                                </span>
                                <span className="font-mono font-medium">
                                    {splitTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        {!isSplitBalanced && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Difference:{' '}
                                {Math.abs(splitTotal - originalAmount).toFixed(
                                    2,
                                )}
                            </div>
                        )}
                        {errors.splitBalance && (
                            <p className="text-xs font-medium text-destructive mt-1">
                                {errors.splitBalance}
                            </p>
                        )}
                    </div>

                    {/* Split Submit Button */}
                    <Button
                        type="button"
                        className="w-full"
                        onClick={handleSplitSubmit}
                        disabled={isPending || !isSplitBalanced}
                    >
                        Confirm Split
                    </Button>
                </div>
            )}

            <hr />

            {/* Optional Fields */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Tags (Optional)</Label>
                    <TagMultiSelect
                        placeholder="Select tags..."
                        options={resolvedTagOptions}
                        onCreate={onCreateTag}
                        value={tagIds}
                        onChange={setTagIds}
                        disabled={isPending}
                        onMenuOpen={() => setIsTagMenuOpen(true)}
                        onMenuClose={() => setIsTagMenuOpen(false)}
                    />
                    {tagIds.length === 0 && effectiveCustomerId && (
                        <QuickAssignSuggestions
                            suggestions={tagQuickAssignSuggestions}
                            isLoading={
                                shouldFetchTagSuggestions &&
                                suggestedTagsQuery.isLoading
                            }
                            onSelect={(tagId) => setTagIds([...tagIds, tagId])}
                            disabled={isPending}
                        />
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isPending}
                        placeholder="Optional notes..."
                    />
                </div>
            </div>

            <SheetFooter>
                <Button className="w-full" disabled={isPending} type="submit">
                    Save changes
                </Button>

                {!!id && onDelete && (
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={onDelete}
                        className="w-full"
                        variant="outline"
                    >
                        <Trash className="mr-2 size-4" />
                        Delete transaction
                    </Button>
                )}
            </SheetFooter>
        </form>
    );
};
