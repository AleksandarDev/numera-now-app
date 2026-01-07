import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AmountInput } from "@/components/amount-input";
import { DatePicker } from "@/components/date-picker";
import { Select } from "@/components/select";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";
import { AccountSelect } from "@/components/account-select";
import { CustomerSelect } from "@/components/customer-select";

// Form schema for editing (single entry)
const formSchema = z.object({
    date: z.date(),
    creditAccountId: z.string().min(1, "Select credit account"),
    debitAccountId: z.string().min(1, "Select debit account"),
    amount: z.string().min(1, "Enter an amount"),
    payeeCustomerId: z.string().optional(),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["draft", "pending", "completed", "reconciled"]).optional(),
});

export type UnifiedEditTransactionFormValues = z.infer<typeof formSchema>;

type Props = {
    id?: string;
    disabled?: boolean;
    categoryOptions: { label: string; value: string }[];
    onCreateCategory: (name: string) => void;
    onCreateCustomer: (name: string) => void;
    onSubmit: (values: UnifiedEditTransactionFormValues) => void;
    onDelete?: () => void;
    defaultValues?: Partial<UnifiedEditTransactionFormValues>;
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
}: Props) => {
    const form = useForm<UnifiedEditTransactionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date(),
            creditAccountId: "",
            debitAccountId: "",
            amount: "0",
            payeeCustomerId: "",
            categoryId: "",
            notes: "",
            ...defaultValues,
        },
    });

    const handleSubmit = (values: UnifiedEditTransactionFormValues) => {
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

                {/* Transaction Entry Section - Credit | Amount | Debit */}
                <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-start">
                        {/* Credit Account */}
                        <FormField
                            control={form.control}
                            name="creditAccountId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <AccountSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={isPending}
                                            placeholder="Credit account..."
                                            excludeReadOnly
                                            allowedTypes={["credit", "neutral"]}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Amount Column */}
                        <div className="w-[140px]">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <AmountInput
                                                {...field}
                                                value={field.value || ""}
                                                disabled={isPending}
                                                placeholder="0.00"
                                                hideSign
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Debit Account */}
                        <FormField
                            control={form.control}
                            name="debitAccountId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <AccountSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={isPending}
                                            placeholder="Debit account..."
                                            excludeReadOnly
                                            allowedTypes={["debit", "neutral"]}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
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
                                        value={field.value || ""}
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
