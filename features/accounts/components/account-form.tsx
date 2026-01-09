import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AmountInput } from '@/components/amount-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { insertAccountSchema } from '@/db/schema';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { ACCOUNT_CLASS_LABELS } from '@/lib/accounting';

const formSchema = insertAccountSchema.pick({
    name: true,
    code: true,
    isOpen: true,
    isReadOnly: true,
    accountType: true,
    accountClass: true,
    openingBalance: true,
});

type FormValues = z.input<typeof formSchema>;

type Props = {
    id?: string;
    defaultValues?: Partial<FormValues>;
    onSubmit: (values: FormValues) => void;
    onDelete?: () => void;
    disabled?: boolean;
};

export const AccountForm = ({
    id,
    defaultValues,
    onSubmit,
    onDelete,
    disabled,
}: Props) => {
    const settingsQuery = useGetSettings();
    const doubleEntryMode = settingsQuery.data?.doubleEntryMode ?? false;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            code: '',
            isOpen: true,
            isReadOnly: false,
            accountType: 'neutral',
            accountClass: undefined,
            openingBalance: 0,
            ...defaultValues,
        },
    });

    const handleSubmit = (values: FormValues) => {
        onSubmit({
            ...values,
            code: (values.code?.length ?? 0) > 0 ? values.code : null,
        });
    };

    const handleDelete = () => {
        onDelete?.();
    };

    const accountClass = form.watch('accountClass');
    const showWarning = doubleEntryMode && !accountClass;
    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4 pt-4 pb-6"
            >
                {showWarning && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Account class is required when double-entry mode is
                            enabled. Please select an account class below.
                        </AlertDescription>
                    </Alert>
                )}
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="e.g. Cash, Credit Card, Bank"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="code"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Code</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="e.g. 0001, CASH, VISA"
                                    {...field}
                                    value={field.value || ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="accountType"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account type</FormLabel>
                            <FormControl>
                                <Select
                                    disabled={disabled}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="neutral">
                                            Neutral (can credit or debit)
                                        </SelectItem>
                                        <SelectItem value="debit">
                                            Debit only
                                        </SelectItem>
                                        <SelectItem value="credit">
                                            Credit only
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {doubleEntryMode && (
                    <>
                        <FormField
                            name="accountClass"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Account Class
                                        {doubleEntryMode && (
                                            <span className="text-red-500 ml-1">
                                                *
                                            </span>
                                        )}
                                    </FormLabel>
                                    <FormControl>
                                        <Select
                                            disabled={disabled}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select account class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="asset">
                                                    {ACCOUNT_CLASS_LABELS.asset}{' '}
                                                    (Debit normal)
                                                </SelectItem>
                                                <SelectItem value="expense">
                                                    {
                                                        ACCOUNT_CLASS_LABELS.expense
                                                    }{' '}
                                                    (Debit normal)
                                                </SelectItem>
                                                <SelectItem value="liability">
                                                    {
                                                        ACCOUNT_CLASS_LABELS.liability
                                                    }{' '}
                                                    (Credit normal)
                                                </SelectItem>
                                                <SelectItem value="equity">
                                                    {
                                                        ACCOUNT_CLASS_LABELS.equity
                                                    }{' '}
                                                    (Credit normal)
                                                </SelectItem>
                                                <SelectItem value="income">
                                                    {
                                                        ACCOUNT_CLASS_LABELS.income
                                                    }{' '}
                                                    (Credit normal)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormDescription>
                                        Select the accounting classification for
                                        this account
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            name="openingBalance"
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Opening Balance</FormLabel>
                                    <FormControl>
                                        <AmountInput
                                            disabled={disabled}
                                            placeholder="0.00"
                                            value={field.value?.toString()}
                                            onChange={(value) => {
                                                const numValue =
                                                    Number.parseFloat(
                                                        value || '0',
                                                    );
                                                field.onChange(
                                                    Number.isNaN(numValue)
                                                        ? 0
                                                        : numValue,
                                                );
                                            }}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Initial balance for this account (in
                                        account currency)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
                <FormField
                    name="isOpen"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={disabled}
                                />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                                Account is open
                            </FormLabel>
                        </FormItem>
                    )}
                />
                <FormField
                    name="isReadOnly"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={disabled}
                                />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                                Read-only account
                            </FormLabel>
                        </FormItem>
                    )}
                />
                <SheetFooter>
                    <Button className="w-full" disabled={disabled}>
                        {id ? 'Save changes' : 'Create Account'}
                    </Button>
                    {!!id && (
                        <Button
                            type="button"
                            disabled={disabled}
                            onClick={handleDelete}
                            className="w-full"
                            variant="outline"
                        >
                            <Trash className="size-4 mr-2" />
                            Delete account
                        </Button>
                    )}
                </SheetFooter>
            </form>
        </Form>
    );
};
