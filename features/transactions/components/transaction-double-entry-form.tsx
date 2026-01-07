import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";
import { insertTransactionSchema } from "@/db/schema";
import { convertAmountToMiliunits } from "@/lib/utils";
import { AccountSelect } from "@/components/account-select";
import { CustomerSelect } from "@/components/customer-select";

const formSchema = z.object({
  date: z.date(),
  creditAccountId: z.string(),
  debitAccountId: z.string(),
  categoryId: z.string().nullable().optional(),
  payeeCustomerId: z.string().nullable().optional(),
  payee: z.string().nullable().optional(),
  amount: z.string(),
  notes: z.string().nullable().optional(),
});

const apiSchema = insertTransactionSchema.omit({
  id: true,
  statusChangedAt: true,
  statusChangedBy: true,
  splitGroupId: true,
  splitType: true,
});

type FormValues = z.infer<typeof formSchema>;
type ApiFormValues = z.infer<typeof apiSchema>;

type TransactionDoubleEntryFormProps = {
  id?: string;
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: ApiFormValues) => void;
  onDelete?: () => void;
  disabled?: boolean;
  creditAccountOptions: { label: string; value: string }[];
  debitAccountOptions: { label: string; value: string }[];
  accountTypeById?: Record<string, "credit" | "debit" | "neutral" | undefined>;
  categoryOptions: { label: string; value: string }[];
  onCreateAccount: (name: string) => void;
  onCreateCategory: (name: string) => void;
  onCreateCustomer: (name: string) => void;
  hasPayee?: boolean;
};

export const TransactionDoubleEntryForm = ({
  id,
  defaultValues,
  onSubmit,
  onDelete,
  disabled,
  creditAccountOptions,
  debitAccountOptions,
  accountTypeById,
  categoryOptions,
  onCreateAccount,
  onCreateCategory,
  onCreateCustomer,
  hasPayee = false,
}: TransactionDoubleEntryFormProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Watch credit and debit account changes for real-time validation
  const creditAccountId = useWatch({
    control: form.control,
    name: "creditAccountId",
  });
  const debitAccountId = useWatch({
    control: form.control,
    name: "debitAccountId",
  });

  // Validate account types in real-time
  useEffect(() => {
    if (!accountTypeById) return;

    const creditType = accountTypeById[creditAccountId];
    const debitType = accountTypeById[debitAccountId];

    if (creditType === "debit") {
      form.setError("creditAccountId", {
        type: "manual",
        message: "This account only supports debits. Pick a credit or neutral account here.",
      });
    } else {
      form.clearErrors("creditAccountId");
    }

    if (debitType === "credit") {
      form.setError("debitAccountId", {
        type: "manual",
        message: "This account only supports credits. Pick a debit or neutral account here.",
      });
    } else {
      form.clearErrors("debitAccountId");
    }
  }, [creditAccountId, debitAccountId, accountTypeById, form]);

  const handleSubmit = (values: FormValues) => {
    const amount = parseFloat(values.amount);
    const amountInMiliunits = convertAmountToMiliunits(amount);

    // Clear payee if customer is selected (migration to customer-based payee)
    const submittedValues = {
      ...values,
      amount: amountInMiliunits,
      payee: values.payeeCustomerId ? null : values.payee,
    };

    onSubmit(submittedValues);
  };

  const handleDelete = () => {
    onDelete?.();
  };
  
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        autoCapitalize="off"
        autoComplete="off"
        className="space-y-4 pt-4 pb-6"
      >
        <FormField
          name="date"
          control={form.control}
          disabled={disabled}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="payeeCustomerId"
          control={form.control}
          disabled={disabled}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer</FormLabel>

              <FormControl>
                <CustomerSelect
                  value={field.value || undefined}
                  onChange={field.onChange}
                  disabled={disabled}
                  placeholder="Select customer..."
                  onCreate={onCreateCustomer}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {hasPayee && (
          <FormField
            name="payee"
            control={form.control}
            disabled={disabled}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Free-form Payee (Legacy)</FormLabel>

                <FormControl>
                  <Input
                    disabled={disabled}
                    placeholder="Free-form payee..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          name="creditAccountId"
          control={form.control}
          disabled={disabled}
          render={({ field }) => {
            const selectedAccount = creditAccountId ? creditAccountOptions.find(opt => opt.value === creditAccountId) : null;
            const accountType = accountTypeById?.[creditAccountId];
            const isInvalid = accountType === "debit";
            
            return (
              <FormItem>
                <FormLabel>Credit Account</FormLabel>

                <FormControl>
                  <AccountSelect
                    placeholder="Select an credit account"
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    excludeReadOnly
                    allowedTypes={["credit", "neutral"]} />
                </FormControl>

                {selectedAccount && isInvalid && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    <strong>Invalid selection:</strong> This account is debit-only. Please select a credit or neutral account.
                  </div>
                )}
                {selectedAccount && !isInvalid && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: <strong>{selectedAccount.label}</strong>
                  </div>
                )}

                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          name="amount"
          control={form.control}
          disabled={disabled}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>

              <FormControl>
                <AmountInput
                  {...field}
                  value={field.value || ""}
                  disabled={disabled}
                  placeholder="0.00"
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="debitAccountId"
          control={form.control}
          disabled={disabled}
          render={({ field }) => {
            const selectedAccount = debitAccountId ? debitAccountOptions.find(opt => opt.value === debitAccountId) : null;
            const accountType = accountTypeById?.[debitAccountId];
            const isInvalid = accountType === "credit";
            
            return (
              <FormItem>
                <FormLabel>Debit Account</FormLabel>

                <FormControl>
                  <AccountSelect
                    placeholder="Select an debit account"
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    excludeReadOnly
                    allowedTypes={["debit", "neutral"]} />
                </FormControl>

                {selectedAccount && isInvalid && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    <strong>Invalid selection:</strong> This account is credit-only. Please select a debit or neutral account.
                  </div>
                )}
                {selectedAccount && !isInvalid && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: <strong>{selectedAccount.label}</strong>
                  </div>
                )}

                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          name="categoryId"
          control={form.control}
          disabled={disabled}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>

              <FormControl>
                <Select
                  placeholder="Select a category"
                  options={categoryOptions}
                  onCreate={onCreateCategory}
                  value={field.value || undefined}
                  onChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="notes"
          control={form.control}
          disabled={disabled}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>

              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  disabled={disabled}
                  placeholder="Optional notes..."
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <SheetFooter>
          <Button className="w-full" disabled={disabled}>
            {id ? "Save changes" : "Create transaction"}
          </Button>

          {!!id && (
            <Button
              type="button"
              disabled={disabled}
              onClick={handleDelete}
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