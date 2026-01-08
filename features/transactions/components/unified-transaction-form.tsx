import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Plus, Trash, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AccountSelect } from '@/components/account-select';
import { AmountInput } from '@/components/amount-input';
import { CustomerSelect } from '@/components/customer-select';
import { DatePicker } from '@/components/date-picker';
import { Select } from '@/components/select';
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
import { cn } from '@/lib/utils';

// Schema for individual credit/debit entries
const creditEntrySchema = z.object({
    accountId: z.string().min(1, 'Select an account'),
    amount: z.string().min(1, 'Enter an amount'),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
});

const debitEntrySchema = z.object({
    accountId: z.string().min(1, 'Select an account'),
    amount: z.string().min(1, 'Enter an amount'),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
});

// Main form schema
const formSchema = z
    .object({
        date: z.date(),
        payeeCustomerId: z.string().optional(),
        notes: z.string().optional(),
        categoryId: z.string().optional(),
        creditEntries: z
            .array(creditEntrySchema)
            .min(1, 'Add at least one credit entry'),
        debitEntries: z
            .array(debitEntrySchema)
            .min(1, 'Add at least one debit entry'),
    })
    .superRefine((data, ctx) => {
        const creditTotal = data.creditEntries.reduce(
            (sum, entry) => sum + parseFloat(entry.amount || '0'),
            0,
        );
        const debitTotal = data.debitEntries.reduce(
            (sum, entry) => sum + parseFloat(entry.amount || '0'),
            0,
        );

        if (Math.abs(creditTotal - debitTotal) > 0.001) {
            ctx.addIssue({
                code: 'custom',
                message: `Credits (${creditTotal.toFixed(2)}) must equal debits (${debitTotal.toFixed(2)})`,
                path: ['creditEntries'],
            });
        }
    });

export type UnifiedTransactionFormValues = z.infer<typeof formSchema>;

type Props = {
    id?: string;
    disabled?: boolean;
    categoryOptions: { label: string; value: string }[];
    onCreateCategory: (name: string) => void;
    onCreateCustomer: (name: string) => void;
    onSubmit: (values: UnifiedTransactionFormValues) => void;
    onDelete?: () => void;
    defaultValues?: Partial<UnifiedTransactionFormValues>;
};

const defaultEntry = { accountId: '', amount: '', categoryId: '', notes: '' };

export const UnifiedTransactionForm = ({
    id,
    disabled,
    categoryOptions,
    onCreateCategory,
    onCreateCustomer,
    onSubmit,
    onDelete,
    defaultValues,
}: Props) => {
    const form = useForm<UnifiedTransactionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date(),
            payeeCustomerId: '',
            notes: '',
            categoryId: '',
            creditEntries: [{ ...defaultEntry }],
            debitEntries: [{ ...defaultEntry }],
            ...defaultValues,
        },
    });

    const {
        fields: creditFields,
        append: appendCredit,
        remove: removeCredit,
    } = useFieldArray({
        control: form.control,
        name: 'creditEntries',
    });

    const {
        fields: debitFields,
        append: appendDebit,
        remove: removeDebit,
    } = useFieldArray({
        control: form.control,
        name: 'debitEntries',
    });

    const creditEntries = useWatch({
        control: form.control,
        name: 'creditEntries',
    });
    const debitEntries = useWatch({
        control: form.control,
        name: 'debitEntries',
    });

    const creditTotal = useMemo(
        () =>
            creditEntries?.reduce(
                (sum, entry) => sum + parseFloat(entry?.amount || '0'),
                0,
            ) || 0,
        [creditEntries],
    );

    const debitTotal = useMemo(
        () =>
            debitEntries?.reduce(
                (sum, entry) => sum + parseFloat(entry?.amount || '0'),
                0,
            ) || 0,
        [debitEntries],
    );

    const isBalanced = Math.abs(creditTotal - debitTotal) < 0.001;
    const isSplitCredit = creditFields.length > 1;
    const isSplitDebit = debitFields.length > 1;
    const isAnySplit = isSplitCredit || isSplitDebit;

    // Auto-sync amounts when one side is split and other is not
    // When credits are split and single debit, debit amount should equal credit total
    // When debits are split and single credit, credit amount should equal debit total
    useEffect(() => {
        if (isSplitCredit && !isSplitDebit && creditTotal > 0) {
            // Multiple credits, single debit - set debit to credit total
            form.setValue('debitEntries.0.amount', creditTotal.toFixed(2));
        } else if (isSplitDebit && !isSplitCredit && debitTotal > 0) {
            // Multiple debits, single credit - set credit to debit total
            form.setValue('creditEntries.0.amount', debitTotal.toFixed(2));
        }
    }, [isSplitCredit, isSplitDebit, creditTotal, debitTotal, form]);

    const handleSubmit = (values: UnifiedTransactionFormValues) => {
        onSubmit(values);
    };

    const isPending = disabled;

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                autoCapitalize="off"
                autoComplete="off"
                className="space-y-6 pt-4 pb-6"
            >
                {/* Date and Customer Section */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        name="date"
                        control={form.control}
                        disabled={isPending}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isPending}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        name="payeeCustomerId"
                        control={form.control}
                        disabled={isPending}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <FormControl>
                                    <CustomerSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isPending}
                                        placeholder="Select customer..."
                                        onCreate={onCreateCustomer}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <hr />

                {/* Transaction Entries Section */}
                <div className="space-y-4">
                    {/* Main Entry Row - First line always visible */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-start">
                        {/* Credit Account Column */}
                        <div className="space-y-2">
                            {creditFields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex items-start"
                                >
                                    <div className="flex-1 space-y-1">
                                        <FormField
                                            control={form.control}
                                            name={`creditEntries.${index}.accountId`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <AccountSelect
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                            disabled={isPending}
                                                            placeholder="Credit account..."
                                                            excludeReadOnly
                                                            allowedTypes={[
                                                                'credit',
                                                                'neutral',
                                                            ]}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {/* Show amount field for each credit when: credits are split, OR debits are split (need individual amounts) */}
                                        {(isSplitCredit ||
                                            (isSplitDebit &&
                                                !isSplitCredit)) && (
                                            <FormField
                                                control={form.control}
                                                name={`creditEntries.${index}.amount`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            {/* When debits are split but credit is single, show read-only synced amount */}
                                                            {isSplitDebit &&
                                                            !isSplitCredit ? (
                                                                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                                                                    {debitTotal.toFixed(
                                                                        2,
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <AmountInput
                                                                    {...field}
                                                                    value={
                                                                        field.value ||
                                                                        ''
                                                                    }
                                                                    disabled={
                                                                        isPending
                                                                    }
                                                                    placeholder="0.00"
                                                                    hideSign
                                                                />
                                                            )}
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                    {creditFields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
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
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                    appendCredit({ ...defaultEntry })
                                }
                                disabled={isPending}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Credit
                            </Button>
                        </div>

                        {/* Amount Column - Only show for single entry mode (1:1) */}
                        <div className="w-[140px]">
                            {!isAnySplit && (
                                <FormField
                                    control={form.control}
                                    name="creditEntries.0.amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <AmountInput
                                                    {...field}
                                                    value={field.value || ''}
                                                    disabled={isPending}
                                                    placeholder="0.00"
                                                    hideSign
                                                    onChange={(value) => {
                                                        field.onChange(value);
                                                        // Sync with debit amount in single entry mode
                                                        form.setValue(
                                                            'debitEntries.0.amount',
                                                            value || '',
                                                        );
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            {isAnySplit && (
                                <div className="h-9 flex items-center justify-center text-sm text-muted-foreground">
                                    <ChevronRight className="size-4" />
                                </div>
                            )}
                        </div>

                        {/* Debit Account Column */}
                        <div className="space-y-2">
                            {debitFields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex gap-2 items-start"
                                >
                                    <div className="flex-1 space-y-2">
                                        <FormField
                                            control={form.control}
                                            name={`debitEntries.${index}.accountId`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <AccountSelect
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                            disabled={isPending}
                                                            placeholder="Debit account..."
                                                            excludeReadOnly
                                                            allowedTypes={[
                                                                'debit',
                                                                'neutral',
                                                            ]}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {/* Show amount field for each debit when: debits are split, OR credits are split (need individual amounts) */}
                                        {(isSplitDebit ||
                                            (isSplitCredit &&
                                                !isSplitDebit)) && (
                                            <FormField
                                                control={form.control}
                                                name={`debitEntries.${index}.amount`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            {/* When credits are split but debit is single, show read-only synced amount */}
                                                            {isSplitCredit &&
                                                            !isSplitDebit ? (
                                                                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                                                                    {creditTotal.toFixed(
                                                                        2,
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <AmountInput
                                                                    {...field}
                                                                    value={
                                                                        field.value ||
                                                                        ''
                                                                    }
                                                                    disabled={
                                                                        isPending
                                                                    }
                                                                    placeholder="0.00"
                                                                    hideSign
                                                                />
                                                            )}
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                    {debitFields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
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
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => appendDebit({ ...defaultEntry })}
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
                                        options={categoryOptions}
                                        onCreate={onCreateCategory}
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={isPending}
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
