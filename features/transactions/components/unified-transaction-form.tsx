'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { ChevronRight, Plus, Trash, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { AccountSelect } from '@/components/account-select';
import { AmountInput } from '@/components/amount-input';
import { CustomerSelect } from '@/components/customer-select';
import { DatePicker } from '@/components/date-picker';
import {
    type QuickAssignSuggestion,
    QuickAssignSuggestions,
} from '@/components/quick-assign-suggestions';
import { Label } from '@/components/ui/label';
import { SheetFooter } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { useGetSuggestedTags } from '@/features/tags/api/use-get-suggested-tags';
import { TagMultiSelect } from '@/features/tags/components/tag-multi-select';
import { useGetSuggestedAccounts } from '@/features/transactions/api/use-get-suggested-accounts';
import { useGetSuggestedCustomers } from '@/features/transactions/api/use-get-suggested-customers';
import { cn } from '@/lib/utils';

// Types for entries
type CreditEntry = {
    id: string;
    accountId: string;
    amount: string;
    notes?: string;
};

type DebitEntry = {
    id: string;
    accountId: string;
    amount: string;
    notes?: string;
};

export type UnifiedTransactionFormValues = {
    date: Date;
    payeeCustomerId?: string;
    notes?: string;
    tagIds?: string[];
    creditEntries: Array<Omit<CreditEntry, 'id'>>;
    debitEntries: Array<Omit<DebitEntry, 'id'>>;
};

type Props = {
    id?: string;
    disabled?: boolean;
    tagOptions: { label: string; value: string; color?: string | null }[];
    onCreateTag: (name: string) => void;
    onCreateCustomer: (name: string) => Promise<string | undefined>;
    onSubmit: (values: UnifiedTransactionFormValues) => void;
    onDelete?: () => void;
    defaultValues?: Partial<UnifiedTransactionFormValues>;
};

const createDefaultEntry = (id: string) => ({
    id,
    accountId: '',
    amount: '',
    notes: '',
});

export const UnifiedTransactionForm = ({
    id,
    disabled,
    tagOptions,
    onCreateTag,
    onCreateCustomer,
    onSubmit,
    onDelete,
    defaultValues,
}: Props) => {
    const baseId = useId();

    // Form state
    const [date, setDate] = useState<Date>(defaultValues?.date ?? new Date());
    const [payeeCustomerId, setPayeeCustomerId] = useState(
        defaultValues?.payeeCustomerId ?? '',
    );
    const [notes, setNotes] = useState(defaultValues?.notes ?? '');
    const [tagIds, setTagIds] = useState<string[]>(defaultValues?.tagIds ?? []);

    // Entry state with unique IDs
    const [creditEntries, setCreditEntries] = useState<CreditEntry[]>(() => {
        if (defaultValues?.creditEntries?.length) {
            return defaultValues.creditEntries.map((entry, idx) => ({
                ...entry,
                id: `${baseId}-credit-${idx}`,
            }));
        }
        return [createDefaultEntry(`${baseId}-credit-0`)];
    });

    const [debitEntries, setDebitEntries] = useState<DebitEntry[]>(() => {
        if (defaultValues?.debitEntries?.length) {
            return defaultValues.debitEntries.map((entry, idx) => ({
                ...entry,
                id: `${baseId}-debit-${idx}`,
            }));
        }
        return [createDefaultEntry(`${baseId}-debit-0`)];
    });

    // Counter for generating unique IDs
    const [creditCounter, setCreditCounter] = useState(
        defaultValues?.creditEntries?.length ?? 1,
    );
    const [debitCounter, setDebitCounter] = useState(
        defaultValues?.debitEntries?.length ?? 1,
    );

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
    const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);

    // Fetch customers list for quick-assign display
    const { data: customers } = useGetCustomers();

    // Use either current value or default value for notes
    const effectiveNotes = notes || defaultValues?.notes || '';
    const effectiveCustomerId =
        payeeCustomerId || defaultValues?.payeeCustomerId || '';
    const effectiveTagIds =
        tagIds.length > 0 ? tagIds : (defaultValues?.tagIds ?? []);

    // Customer suggestions - fetch when customer is not set and we have notes
    const shouldFetchCustomerSuggestions =
        !effectiveCustomerId && !!effectiveNotes;
    const suggestedCustomersQuery = useGetSuggestedCustomers(
        '',
        effectiveNotes,
        {
            enabled: shouldFetchCustomerSuggestions,
        },
    );

    // Check first credit entry for quick-assign (simplified for split transactions)
    const firstCreditAccountId = creditEntries[0]?.accountId;
    const firstDebitAccountId = debitEntries[0]?.accountId;

    // Account suggestions - fetch when customer is selected
    const shouldFetchAccountSuggestions =
        !!effectiveCustomerId &&
        (!firstCreditAccountId || !firstDebitAccountId);
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

    const creditTotal = useMemo(
        () =>
            creditEntries.reduce(
                (sum, entry) => sum + parseFloat(entry.amount || '0'),
                0,
            ),
        [creditEntries],
    );

    const debitTotal = useMemo(
        () =>
            debitEntries.reduce(
                (sum, entry) => sum + parseFloat(entry.amount || '0'),
                0,
            ),
        [debitEntries],
    );

    const isBalanced = Math.abs(creditTotal - debitTotal) < 0.001;
    const isSplitCredit = creditEntries.length > 1;
    const isSplitDebit = debitEntries.length > 1;
    const isAnySplit = isSplitCredit || isSplitDebit;

    // Auto-sync amounts when one side is split and other is not
    useEffect(() => {
        if (isSplitCredit && !isSplitDebit && creditTotal > 0) {
            setDebitEntries((prev) => {
                if (prev[0]?.amount !== creditTotal.toFixed(2)) {
                    return [{ ...prev[0], amount: creditTotal.toFixed(2) }];
                }
                return prev;
            });
        } else if (isSplitDebit && !isSplitCredit && debitTotal > 0) {
            setCreditEntries((prev) => {
                if (prev[0]?.amount !== debitTotal.toFixed(2)) {
                    return [{ ...prev[0], amount: debitTotal.toFixed(2) }];
                }
                return prev;
            });
        }
    }, [isSplitCredit, isSplitDebit, creditTotal, debitTotal]);

    // Entry management functions
    const appendCredit = () => {
        const newEntry = createDefaultEntry(
            `${baseId}-credit-${creditCounter}`,
        );
        setCreditCounter((c) => c + 1);
        setCreditEntries((prev) => [...prev, newEntry]);
    };

    const removeCredit = (index: number) => {
        setCreditEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const updateCreditEntry = (
        index: number,
        field: keyof CreditEntry,
        value: string,
    ) => {
        setCreditEntries((prev) =>
            prev.map((entry, i) =>
                i === index ? { ...entry, [field]: value } : entry,
            ),
        );
    };

    const appendDebit = () => {
        const newEntry = createDefaultEntry(`${baseId}-debit-${debitCounter}`);
        setDebitCounter((c) => c + 1);
        setDebitEntries((prev) => [...prev, newEntry]);
    };

    const removeDebit = (index: number) => {
        setDebitEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const updateDebitEntry = (
        index: number,
        field: keyof DebitEntry,
        value: string,
    ) => {
        setDebitEntries((prev) =>
            prev.map((entry, i) =>
                i === index ? { ...entry, [field]: value } : entry,
            ),
        );
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Check all credit entries have accounts and amounts
        creditEntries.forEach((entry, index) => {
            if (!entry.accountId) {
                newErrors[`creditEntries.${index}.accountId`] =
                    'Select an account';
            }
            if (!entry.amount) {
                newErrors[`creditEntries.${index}.amount`] = 'Enter an amount';
            }
        });

        // Check all debit entries have accounts and amounts
        debitEntries.forEach((entry, index) => {
            if (!entry.accountId) {
                newErrors[`debitEntries.${index}.accountId`] =
                    'Select an account';
            }
            if (!entry.amount) {
                newErrors[`debitEntries.${index}.amount`] = 'Enter an amount';
            }
        });

        // Check balance
        if (!isBalanced) {
            newErrors.balance = `Credits (${creditTotal.toFixed(2)}) must equal debits (${debitTotal.toFixed(2)})`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onSubmit({
            date,
            payeeCustomerId: payeeCustomerId || undefined,
            notes: notes || undefined,
            tagIds: tagIds.length > 0 ? tagIds : undefined,
            creditEntries: creditEntries.map(({ id: _id, ...entry }) => entry),
            debitEntries: debitEntries.map(({ id: _id, ...entry }) => entry),
        });
    };

    const isPending = disabled;

    return (
        <form
            onSubmit={handleSubmit}
            autoCapitalize="off"
            autoComplete="off"
            className="space-y-6"
        >
            {/* Date, Customer Section */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label>Date</Label>
                    <DatePicker
                        value={date}
                        onChange={(newDate) => newDate && setDate(newDate)}
                        disabled={isPending}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Customer</Label>
                    <CustomerSelect
                        value={payeeCustomerId}
                        onChange={(value) => setPayeeCustomerId(value ?? '')}
                        disabled={isPending}
                        placeholder="Select customer..."
                        onCreate={onCreateCustomer}
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
                            disabled={isPending}
                        />
                    )}
                </div>
            </div>

            <hr />

            {/* Transaction Entries Section */}
            <div className="space-y-4">
                {/* Main Entry Row - First line always visible */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-start">
                    {/* Credit Account Column */}
                    <div className="space-y-2">
                        {creditEntries.map((entry, index) => (
                            <div key={entry.id} className="flex items-start">
                                <div className="flex-1 space-y-1">
                                    <AccountSelect
                                        value={entry.accountId}
                                        onChange={(value) =>
                                            updateCreditEntry(
                                                index,
                                                'accountId',
                                                value,
                                            )
                                        }
                                        disabled={isPending}
                                        placeholder="Credit account..."
                                        excludeReadOnly
                                        allowedTypes={['credit', 'neutral']}
                                        suggestedAccountIds={
                                            suggestedCreditAccountIds
                                        }
                                        onOpenChange={setIsAccountSelectOpen}
                                    />
                                    {errors[
                                        `creditEntries.${index}.accountId`
                                    ] && (
                                        <p className="text-sm font-medium text-destructive">
                                            {
                                                errors[
                                                    `creditEntries.${index}.accountId`
                                                ]
                                            }
                                        </p>
                                    )}
                                    {/* Show amount field for each credit when: credits are split, OR debits are split */}
                                    {(isSplitCredit ||
                                        (isSplitDebit && !isSplitCredit)) && (
                                        <>
                                            {/* When debits are split but credit is single, show read-only synced amount */}
                                            {isSplitDebit && !isSplitCredit ? (
                                                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                                                    {debitTotal.toFixed(2)}
                                                </div>
                                            ) : (
                                                <AmountInput
                                                    value={entry.amount}
                                                    onChange={(value) =>
                                                        updateCreditEntry(
                                                            index,
                                                            'amount',
                                                            value ?? '',
                                                        )
                                                    }
                                                    disabled={isPending}
                                                    placeholder="0.00"
                                                    hideSign
                                                />
                                            )}
                                            {errors[
                                                `creditEntries.${index}.amount`
                                            ] && (
                                                <p className="text-sm font-medium text-destructive">
                                                    {
                                                        errors[
                                                            `creditEntries.${index}.amount`
                                                        ]
                                                    }
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                                {creditEntries.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="plain"
                                        className="h-10 w-10 p-0"
                                        onClick={() => removeCredit(index)}
                                        disabled={isPending}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            className="w-full"
                            onClick={appendCredit}
                            disabled={isPending}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add Credit
                        </Button>
                    </div>

                    {/* Amount Column - Only show for single entry mode (1:1) */}
                    <div className="w-[140px]">
                        {!isAnySplit && (
                            <div className="space-y-1">
                                <AmountInput
                                    value={creditEntries[0]?.amount ?? ''}
                                    onChange={(value) => {
                                        updateCreditEntry(
                                            0,
                                            'amount',
                                            value ?? '',
                                        );
                                        // Sync with debit amount in single entry mode
                                        updateDebitEntry(
                                            0,
                                            'amount',
                                            value ?? '',
                                        );
                                    }}
                                    disabled={isPending}
                                    placeholder="0.00"
                                    hideSign
                                />
                                {errors['creditEntries.0.amount'] && (
                                    <p className="text-sm font-medium text-destructive">
                                        {errors['creditEntries.0.amount']}
                                    </p>
                                )}
                            </div>
                        )}
                        {isAnySplit && (
                            <div className="h-10 flex items-center justify-center text-sm text-muted-foreground">
                                <ChevronRight className="size-4" />
                            </div>
                        )}
                    </div>

                    {/* Debit Account Column */}
                    <div className="space-y-2">
                        {debitEntries.map((entry, index) => (
                            <div
                                key={entry.id}
                                className="flex gap-2 items-start"
                            >
                                <div className="flex-1 space-y-2">
                                    <AccountSelect
                                        value={entry.accountId}
                                        onChange={(value) =>
                                            updateDebitEntry(
                                                index,
                                                'accountId',
                                                value,
                                            )
                                        }
                                        disabled={isPending}
                                        placeholder="Debit account..."
                                        excludeReadOnly
                                        allowedTypes={['debit', 'neutral']}
                                        suggestedAccountIds={
                                            suggestedDebitAccountIds
                                        }
                                        onOpenChange={setIsAccountSelectOpen}
                                    />
                                    {errors[
                                        `debitEntries.${index}.accountId`
                                    ] && (
                                        <p className="text-sm font-medium text-destructive">
                                            {
                                                errors[
                                                    `debitEntries.${index}.accountId`
                                                ]
                                            }
                                        </p>
                                    )}
                                    {/* Show amount field for each debit when: debits are split, OR credits are split */}
                                    {(isSplitDebit ||
                                        (isSplitCredit && !isSplitDebit)) && (
                                        <>
                                            {/* When credits are split but debit is single, show read-only synced amount */}
                                            {isSplitCredit && !isSplitDebit ? (
                                                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                                                    {creditTotal.toFixed(2)}
                                                </div>
                                            ) : (
                                                <AmountInput
                                                    value={entry.amount}
                                                    onChange={(value) =>
                                                        updateDebitEntry(
                                                            index,
                                                            'amount',
                                                            value ?? '',
                                                        )
                                                    }
                                                    disabled={isPending}
                                                    placeholder="0.00"
                                                    hideSign
                                                />
                                            )}
                                            {errors[
                                                `debitEntries.${index}.amount`
                                            ] && (
                                                <p className="text-sm font-medium text-destructive">
                                                    {
                                                        errors[
                                                            `debitEntries.${index}.amount`
                                                        ]
                                                    }
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                                {debitEntries.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="plain"
                                        className="h-10 w-10 p-0"
                                        onClick={() => removeDebit(index)}
                                        disabled={isPending}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            className="w-full"
                            onClick={appendDebit}
                            disabled={isPending}
                        >
                            <Plus className="h-4 w-4 mr-1" /> Add Debit
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Section */}
            <div
                className={cn(
                    'rounded-lg border p-4 space-y-2',
                    isBalanced
                        ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                        : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
                )}
            >
                <div className="flex justify-between text-sm">
                    <span className="font-medium">Summary</span>
                    {isBalanced ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                            ✓ Balanced
                        </span>
                    ) : (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                            ⚠ Unbalanced
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            Total Credits:
                        </span>
                        <span className="font-mono font-medium">
                            {creditTotal.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">
                            Total Debits:
                        </span>
                        <span className="font-mono font-medium">
                            {debitTotal.toFixed(2)}
                        </span>
                    </div>
                </div>
                {!isBalanced && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                        Difference:{' '}
                        {Math.abs(creditTotal - debitTotal).toFixed(2)}
                        {creditTotal > debitTotal
                            ? ' (Credits exceed Debits)'
                            : ' (Debits exceed Credits)'}
                    </div>
                )}
            </div>

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
                <Button
                    className="w-full"
                    disabled={isPending || !isBalanced}
                    type="submit"
                >
                    {id ? 'Save changes' : 'Create transaction'}
                </Button>

                {!!id && onDelete && (
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={onDelete}
                        className="w-full"
                        variant="outlined"
                    >
                        <Trash className="mr-2 size-4" />
                        Delete transaction
                    </Button>
                )}
            </SheetFooter>
        </form>
    );
};
