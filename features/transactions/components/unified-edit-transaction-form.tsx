import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Lock, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AccountSelect } from '@/components/account-select';
import { AmountInput } from '@/components/amount-input';
import { CustomerSelect } from '@/components/customer-select';
import { DatePicker } from '@/components/date-picker';
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
import { useGetSuggestedAccounts } from '@/features/transactions/api/use-get-suggested-accounts';
import { useGetSuggestedCategories } from '@/features/transactions/api/use-get-suggested-categories';

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
    onCreateCustomer: (name: string) => void;
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

    const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

    const suggestedAccountsQuery = useGetSuggestedAccounts(payeeCustomerId, {
        enabled: isAccountSelectOpen,
    });
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

    const suggestedCategoriesQuery = useGetSuggestedCategories(
        payeeCustomerId,
        {
            enabled: isCategoryMenuOpen,
        },
    );
    const suggestedCategoryIds = useMemo(
        () =>
            suggestedCategoriesQuery.data?.map(
                (suggestion) => suggestion.categoryId,
            ) ?? [],
        [suggestedCategoriesQuery.data],
    );
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
                                    />
                                </FormControl>
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
                <div className="grid grid-cols-[2fr_16px_minmax(min-content,1fr)_16px_2fr] items-center gap-1">
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
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <ChevronRight className="size-4 opacity-60" />

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

                    <ChevronRight className="size-4 opacity-60" />

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
