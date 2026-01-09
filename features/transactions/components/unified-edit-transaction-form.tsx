'use client';

import { ChevronRight, Lock, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
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

type Props = {
    id?: string;
    disabled?: boolean;
    tagOptions: { label: string; value: string; color?: string | null }[];
    onCreateTag: (name: string) => void;
    onCreateCustomer: (name: string) => Promise<string | undefined>;
    onSubmit: (values: UnifiedEditTransactionFormValues) => void;
    onDelete?: () => void;
    defaultValues?: Partial<UnifiedEditTransactionFormValues>;
    /** Raw payee text (when customer is not matched) */
    payeeText?: string | null;
    /** Current transaction status - used for conditional validation and field disabling */
    currentStatus?: 'draft' | 'pending' | 'completed' | 'reconciled';
};

export const UnifiedEditTransactionForm = ({
    id,
    disabled,
    tagOptions,
    onCreateTag,
    onCreateCustomer,
    onSubmit,
    onDelete,
    defaultValues,
    payeeText,
    currentStatus = 'draft',
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
