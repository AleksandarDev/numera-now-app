import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { convertAmountToMiliunits } from "@/lib/utils";
import { useCreateSplitTransaction } from "@/features/transactions/api/use-create-split-transaction";

const splitRowSchema = z.object({
  amount: z.string(),
  notes: z.string().nullable().optional(),
  accountId: z.string().optional(),
  creditAccountId: z.string().optional(),
  debitAccountId: z.string().optional(),
  categoryId: z.string().optional(),
});

const formSchema = z.object({
  date: z.date(),
  status: z.enum(["draft", "pending", "completed", "reconciled"]).default("pending"),
  payeeCustomerId: z.string().optional(),
  payee: z.string().optional(),
  notes: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  splits: z.array(splitRowSchema).min(2, "Add at least two splits"),
  doubleEntry: z.boolean().default(false),
}).superRefine((data, ctx) => {
  data.splits.forEach((split, index) => {
    const hasSingle = !!split.accountId;
    const hasDouble = !!split.creditAccountId && !!split.debitAccountId;
    if (!hasSingle && !hasDouble) {
      ctx.addIssue({
        code: "custom",
        path: ["splits", index],
        message: "Provide account or both credit/debit accounts",
      });
    }
  });
});

export type SplitTransactionFormValues = z.infer<typeof formSchema>;

type Props = {
  disabled?: boolean;
  categoryOptions: { label: string; value: string }[];
  onCreateCategory: (name: string) => void;
  onCreateCustomer: (name: string) => void;
  onSuccess?: () => void;
  defaultValues: SplitTransactionFormValues;
};

export const SplitTransactionForm = ({
  disabled,
  categoryOptions,
  onCreateCategory,
  onCreateCustomer,
  onSuccess,
  defaultValues,
}: Props) => {
  const createSplit = useCreateSplitTransaction();

  const form = useForm<SplitTransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "splits",
  });

  const splits = form.watch("splits");
  const doubleEntryMode = form.watch("doubleEntry");

  const debitTotal = doubleEntryMode
    ? splits.reduce((sum, s) => sum + (parseFloat(s.debitAccountId ? s.amount || "0" : "0")), 0)
    : 0;
  const creditTotal = doubleEntryMode
    ? splits.reduce((sum, s) => sum + (parseFloat(s.creditAccountId ? s.amount || "0" : "0")), 0)
    : 0;
  const total = splits.reduce((sum, s) => sum + parseFloat(s.amount || "0"), 0);
  const imbalance = doubleEntryMode && Math.abs(debitTotal - creditTotal) > 0.01;

  const onSubmit = (values: SplitTransactionFormValues) => {
    if (values.doubleEntry && imbalance) {
      form.setError("splits", { type: "custom", message: "Debits and credits must balance." });
      return;
    }
    const total = values.splits.reduce((sum, s) => sum + parseFloat(s.amount || "0"), 0);
    const parentAmount = convertAmountToMiliunits(total);

    createSplit.mutate(
      {
        parentTransaction: {
          date: values.date,
          payeeCustomerId: values.payeeCustomerId,
          payee: values.payee,
          notes: values.notes,
          categoryId: values.categoryId,
          amount: parentAmount,
          status: values.status,
        },
        splits: values.splits.map((split) => ({
          amount: convertAmountToMiliunits(parseFloat(split.amount || "0")),
          accountId: values.doubleEntry ? undefined : split.accountId,
          creditAccountId: values.doubleEntry ? split.creditAccountId : undefined,
          debitAccountId: values.doubleEntry ? split.debitAccountId : undefined,
          categoryId: split.categoryId,
          notes: split.notes || undefined,
        })),
      },
      {
        onSuccess,
      }
    );
  };

  const isPending = disabled || createSplit.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        autoCapitalize="off"
        autoComplete="off"
        className="space-y-4 pt-4 pb-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            name="date"
            control={form.control}
            disabled={isPending}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} disabled={isPending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="status"
            control={form.control}
            disabled={isPending}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Select
                    placeholder="Select status"
                    options={[
                      { label: "Draft", value: "draft" },
                      { label: "Pending", value: "pending" },
                      { label: "Completed", value: "completed" },
                      { label: "Reconciled", value: "reconciled" },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        <FormField
          name="notes"
          control={form.control}
          disabled={isPending}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
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

        <div className="flex flex-wrap items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <div className="flex gap-3">
            <span className="font-medium">Total: {total.toFixed(2)}</span>
            {doubleEntryMode && (
              <>
                <span className="text-muted-foreground">Debits: {debitTotal.toFixed(2)}</span>
                <span className="text-muted-foreground">Credits: {creditTotal.toFixed(2)}</span>
              </>
            )}
          </div>
          {imbalance && (
            <span className="text-xs text-destructive">Debits and credits must match.</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {fields.length} splits · Total {form.watch("splits").reduce((sum, s) => sum + (parseFloat(s.amount || "0")), 0).toFixed(2)}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ amount: "", accountId: "", creditAccountId: "", debitAccountId: "", categoryId: "" })
            }
            disabled={isPending}
          >
            <Plus className="mr-2 size-4" /> Add split
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const hasDouble = form.watch("doubleEntry");
            return (
              <div key={field.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Split {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={isPending || fields.length <= 2}
                  >
                    <Trash className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`splits.${index}.amount`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <AmountInput
                            {...field}
                            value={field.value || ""}
                            disabled={isPending}
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`splits.${index}.categoryId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Select
                            placeholder="Select category"
                            options={categoryOptions}
                            onCreate={onCreateCategory}
                            value={field.value || undefined}
                            onChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {hasDouble ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`splits.${index}.creditAccountId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Account</FormLabel>
                          <FormControl>
                            <AccountSelect
                              value={field.value || ""}
                              onChange={field.onChange}
                              disabled={isPending}
                              excludeReadOnly
                              allowedTypes={["credit", "neutral"]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`splits.${index}.debitAccountId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Debit Account</FormLabel>
                          <FormControl>
                            <AccountSelect
                              value={field.value || ""}
                              onChange={field.onChange}
                              disabled={isPending}
                              excludeReadOnly
                              allowedTypes={["debit", "neutral"]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name={`splits.${index}.accountId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account</FormLabel>
                        <FormControl>
                          <AccountSelect
                            value={field.value || ""}
                            onChange={field.onChange}
                            disabled={isPending}
                            excludeReadOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name={`splits.${index}.notes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
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
            );
          })}
        </div>

        <SheetFooter>
          <Button className="w-full" disabled={isPending}>
            Create split transaction
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
};
