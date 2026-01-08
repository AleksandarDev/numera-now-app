import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Lock, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AccountSelect } from '@/components/account-select';
import { AmountInput } from '@/components/amount-input';
import { CustomerSelect } from '@/components/customer-select';
import { DatePicker } from '@/components/date-picker';
import {
    type QuickAssignSuggestion,
    QuickAssignSuggestions,
} from '@/components/quick-assign-suggestions';
import { Select } from '@/components/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { SheetFooter } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { useGetSuggestedAccounts } from '@/features/transactions/api/use-get-suggested-accounts';
import { useGetSuggestedCategories } from '@/features/transactions/api/use-get-suggested-categories';
import { useGetSuggestedCustomers } from '@/features/transactions/api/use-get-suggested-customers';

// Base form schema - accounts are optional, validation depends on status
const baseFormSchema = z.object({
    date: z.date(),
    creditAccountId: z.string().optional(),
    debitAccountId: z.string().optional(),
    amount: z.string().min(1, 'Enter an amount'),
    payeeCustomerId: z.string().optional(),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['draft', 'pending', 'completed', 'reconciled']).optional(),
});

// Create a schema that validates accounts based on current status
const createFormSchema = (
    currentStatus: 'draft' | 'pending' | 'completed' | 'reconciled',
) => {
    return baseFormSchema.superRefine((data, ctx) => {
        // For non-draft transactions, require both accounts
        if (currentStatus !== 'draft') {
            if (!data.creditAccountId || data.creditAccountId === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Select credit account',
                    path: ['creditAccountId'],
                });
            }
            if (!data.debitAccountId || data.debitAccountId === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Select debit account',
                    path: ['debitAccountId'],
                });
            }
        }
    });
};

export type UnifiedEditTransactionFormValues = z.infer<typeof baseFormSchema>;

type Props = {
    id?: string;
    disabled?: boolean;
    categoryOptions: { label: string; value: string }[];
    onCreateCategory: (name: string) => void;
    onCreateCustomer: (name: string) => Promise<string | undefined> | void;
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
    categoryOptions,
    onCreateCategory,
    onCreateCustomer,
    onSubmit,
    onDelete,
    defaultValues,
    payeeText,
    currentStatus = 'draft',
}: Props) => {
    // Create schema based on current status
    const formSchema = createFormSchema(currentStatus);

    const form = useForm<UnifiedEditTransactionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date(),
            creditAccountId: '',
            debitAccountId: '',
            amount: '0',
            payeeCustomerId: '',
            categoryId: '',
            notes: '',
            ...defaultValues,
        },
    });

    const payeeCustomerId = useWatch({
        control: form.control,
        name: 'payeeCustomerId',
    });

    const notesValue = useWatch({
        control: form.control,
        name: 'notes',
    });

    const creditAccountId = useWatch({
        control: form.control,
        name: 'creditAccountId',
    });

    const debitAccountId = useWatch({
        control: form.control,
        name: 'debitAccountId',
    });

    const categoryId = useWatch({
        control: form.control,
        name: 'categoryId',
    });

    const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

    // Fetch customers list for quick-assign display
    const { data: customers } = useGetCustomers();

    // Fetch accounts list for quick-assign display
    const { data: accounts } = useGetAccounts({ pageSize: 9999 });

    // Use either watched value or default value for notes (watched value may be empty on first render)
    const effectiveNotes = notesValue || defaultValues?.notes || '';

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
    // Use defaultValues as fallback for initial render
    const effectiveCustomerId =
        payeeCustomerId || defaultValues?.payeeCustomerId || '';
    const effectiveCreditAccountId =
        creditAccountId || defaultValues?.creditAccountId || '';
    const effectiveDebitAccountId =
        debitAccountId || defaultValues?.debitAccountId || '';
    const effectiveCategoryId = categoryId || defaultValues?.categoryId || '';

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

    // Category suggestions - fetch when customer is selected but category is not set
    const shouldFetchCategorySuggestions =
        !!effectiveCustomerId && !effectiveCategoryId;
    const suggestedCategoriesQuery = useGetSuggestedCategories(
        effectiveCustomerId,
        {
            enabled: shouldFetchCategorySuggestions || isCategoryMenuOpen,
        },
    );
    const suggestedCategoryIds = useMemo(
        () =>
            suggestedCategoriesQuery.data?.map(
                (suggestion) => suggestion.categoryId,
            ) ?? [],
        [suggestedCategoriesQuery.data],
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

    // Quick-assign suggestions for category
    const categoryQuickAssignSuggestions = useMemo<
        QuickAssignSuggestion[]
    >(() => {
        if (effectiveCategoryId || !suggestedCategoryIds.length) return [];
        return suggestedCategoryIds.slice(0, 3).map((catId) => {
            const category = categoryOptions.find((c) => c.value === catId);
            return {
                id: catId,
                label: category?.label ?? 'Unknown',
            };
        });
    }, [suggestedCategoryIds, categoryOptions, effectiveCategoryId]);

    const resolvedCategoryOptions = useMemo(() => {
        if (suggestedCategoryIds.length === 0) {
            return categoryOptions;
        }

        const suggestedIdSet = new Set(suggestedCategoryIds);
        const suggested = categoryOptions
            .filter((option) => suggestedIdSet.has(option.value))
            .map((option) => ({ ...option, suggested: true }));
        const remaining = categoryOptions.filter(
            (option) => !suggestedIdSet.has(option.value),
        );

        return [...suggested, ...remaining];
    }, [categoryOptions, suggestedCategoryIds]);

    const handleSubmit = (values: UnifiedEditTransactionFormValues) => {
        onSubmit(values);
    };

    // Check if transaction is reconciled (fully locked)
    const isReconciled = currentStatus === 'reconciled';
    // Check if transaction is completed (lock financial fields)
    const isCompleted = currentStatus === 'completed';

    // Determine which fields should be disabled
    const isPending = disabled || isReconciled;
    const isFinancialFieldsLocked = isCompleted || isReconciled;

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                autoCapitalize="off"
                autoComplete="off"
                className="space-y-6"
            >
                {/* Status-based alerts */}
                {isReconciled && (
                    <Alert>
                        <Lock className="size-4" />
                        <AlertDescription>
                            This transaction is reconciled and cannot be edited.
                        </AlertDescription>
                    </Alert>
                )}
                {isCompleted && !isReconciled && (
                    <Alert>
                        <Lock className="size-4" />
                        <AlertDescription>
                            This transaction is completed. Accounts, amount,
                            date, and customer cannot be changed.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Date and Customer Section */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        name="date"
                        control={form.control}
                        disabled={isFinancialFieldsLocked}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isFinancialFieldsLocked}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        name="payeeCustomerId"
                        control={form.control}
                        disabled={isFinancialFieldsLocked}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Customer{' '}
                                    {isFinancialFieldsLocked && (
                                        <Lock className="inline h-3 w-3 ml-1" />
                                    )}
                                </FormLabel>
                                <FormControl>
                                    <CustomerSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isFinancialFieldsLocked}
                                        placeholder="Select customer..."
                                        onCreate={onCreateCustomer}
                                        suggestionQuery={payeeText ?? ''}
                                        suggestionNotes={notesValue ?? ''}
                                    />
                                </FormControl>
                                {!field.value && (
                                    <QuickAssignSuggestions
                                        suggestions={
                                            customerQuickAssignSuggestions
                                        }
                                        isLoading={
                                            shouldFetchCustomerSuggestions &&
                                            suggestedCustomersQuery.isLoading
                                        }
                                        onSelect={(id) =>
                                            form.setValue(
                                                'payeeCustomerId',
                                                id,
                                                {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                    shouldTouch: true,
                                                },
                                            )
                                        }
                                        disabled={isFinancialFieldsLocked}
                                    />
                                )}
                                {payeeText && !field.value && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        Imported payee:{' '}
                                        <span className="font-medium">
                                            {payeeText}
                                        </span>
                                    </p>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <hr />

                {/* Transaction Entry Section - Credit | Amount | Debit */}
                <div className="grid grid-cols-[2fr_16px_minmax(min-content,1fr)_16px_2fr] items-start gap-1">
                    {/* Credit Account */}
                    <FormField
                        control={form.control}
                        name="creditAccountId"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <AccountSelect
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        disabled={isFinancialFieldsLocked}
                                        placeholder="Credit account..."
                                        excludeReadOnly
                                        allowedTypes={['credit', 'neutral']}
                                        suggestedAccountIds={
                                            suggestedCreditAccountIds
                                        }
                                        onOpenChange={setIsAccountSelectOpen}
                                    />
                                </FormControl>
                                {!field.value && effectiveCustomerId && (
                                    <QuickAssignSuggestions
                                        suggestions={
                                            creditAccountQuickAssignSuggestions
                                        }
                                        isLoading={
                                            shouldFetchAccountSuggestions &&
                                            suggestedAccountsQuery.isLoading
                                        }
                                        onSelect={(id) =>
                                            form.setValue(
                                                'creditAccountId',
                                                id,
                                                {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                    shouldTouch: true,
                                                },
                                            )
                                        }
                                        disabled={isFinancialFieldsLocked}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <ChevronRight className="size-4 opacity-60 mt-2.5" />

                    {/* Amount Column */}
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <AmountInput
                                        {...field}
                                        value={field.value || ''}
                                        disabled={isFinancialFieldsLocked}
                                        placeholder="0.00"
                                        hideSign
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <ChevronRight className="size-4 opacity-60 mt-2.5" />

                    {/* Debit Account */}
                    <FormField
                        control={form.control}
                        name="debitAccountId"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <AccountSelect
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        disabled={isFinancialFieldsLocked}
                                        placeholder="Debit account..."
                                        excludeReadOnly
                                        allowedTypes={['debit', 'neutral']}
                                        suggestedAccountIds={
                                            suggestedDebitAccountIds
                                        }
                                        onOpenChange={setIsAccountSelectOpen}
                                    />
                                </FormControl>
                                {!field.value && effectiveCustomerId && (
                                    <QuickAssignSuggestions
                                        suggestions={
                                            debitAccountQuickAssignSuggestions
                                        }
                                        isLoading={
                                            shouldFetchAccountSuggestions &&
                                            suggestedAccountsQuery.isLoading
                                        }
                                        onSelect={(id) =>
                                            form.setValue(
                                                'debitAccountId',
                                                id,
                                                {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                    shouldTouch: true,
                                                },
                                            )
                                        }
                                        disabled={isFinancialFieldsLocked}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <hr />

                {/* Optional Fields */}
                <div className="space-y-4">
                    <FormField
                        name="categoryId"
                        control={form.control}
                        disabled={isPending}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category (Optional)</FormLabel>
                                <FormControl>
                                    <Select
                                        placeholder="Select a category"
                                        options={resolvedCategoryOptions}
                                        onCreate={onCreateCategory}
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isPending}
                                        onMenuOpen={() =>
                                            setIsCategoryMenuOpen(true)
                                        }
                                        onMenuClose={() =>
                                            setIsCategoryMenuOpen(false)
                                        }
                                    />
                                </FormControl>
                                {!field.value && effectiveCustomerId && (
                                    <QuickAssignSuggestions
                                        suggestions={
                                            categoryQuickAssignSuggestions
                                        }
                                        isLoading={
                                            shouldFetchCategorySuggestions &&
                                            suggestedCategoriesQuery.isLoading
                                        }
                                        onSelect={field.onChange}
                                        disabled={isPending}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        name="notes"
                        control={form.control}
                        disabled={isPending}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        value={field.value || ''}
                                        disabled={isPending}
                                        placeholder="Optional notes..."
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <SheetFooter>
                    <Button
                        className="w-full"
                        disabled={isPending}
                        type="submit"
                    >
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
        </Form>
    );
};
