import { Loader2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { z } from "zod";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { insertTransactionSchema } from "@/db/schema";
import { useCreateAccount } from "@/features/accounts/api/use-create-account";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useCreateCategory } from "@/features/categories/api/use-create-category";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useCreateCustomer } from "@/features/customers/api/use-create-customer";
import { useDeleteTransaction } from "@/features/transactions/api/use-delete-transaction";
import { useEditTransaction } from "@/features/transactions/api/use-edit-transaction";
import { useGetTransaction } from "@/features/transactions/api/use-get-transaction";
import { useGetStatusHistory } from "@/features/transactions/api/use-get-status-history";
import { useGetSplitGroup } from "@/features/transactions/api/use-get-split-group";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { useConfirm } from "@/hooks/use-confirm";
import { formatCurrency } from "@/lib/utils";
import { DocumentsTab } from "@/components/documents-tab";
import { TransactionReconciliationStatus } from "@/components/transaction-reconciliation-status";

import { TransactionForm } from "./transaction-form";
import { TransactionDoubleEntryForm } from "./transaction-double-entry-form";

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;
type TransactionFormValues = {
  date: Date;
  accountId: string;
  categoryId?: string | null;
  payeeCustomerId?: string;
  payee?: string;
  amount: string;
  notes?: string | null;
  status?: "draft" | "pending" | "completed" | "reconciled";
};
type TransactionDoubleEntryFormValues = {
  date: Date;
  creditAccountId: string;
  debitAccountId: string;
  categoryId?: string | null;
  payeeCustomerId?: string | null;
  payee?: string | null;
  amount: string;
  notes?: string | null;
  status?: "draft" | "pending" | "completed" | "reconciled";
};

export const EditTransactionSheet = () => {
  const { isOpen, onClose, id } = useOpenTransaction();

  const [ConfirmDialog, confirm] = useConfirm(
    "Are you sure?",
    "You are about to delete this transaction."
  );

  const transactionQuery = useGetTransaction(id);
  const statusHistoryQuery = useGetStatusHistory(id);
  const splitGroupQuery = useGetSplitGroup(transactionQuery.data?.splitGroupId);
  const editMutation = useEditTransaction(id);
  const deleteMutation = useDeleteTransaction(id);

  const categoryMutation = useCreateCategory();
  const categoryQuery = useGetCategories();
  const categoryOptions = (categoryQuery.data ?? []).map((category) => ({
    label: category.name,
    value: category.id,
  }));

  const accountMutation = useCreateAccount();
  const accountsQuery = useGetAccounts();
  const accountOptions = (accountsQuery.data ?? []).map((account) => ({
    label: account.name,
    value: account.id,
  }));
  // TODO: Move options to custom select component
  const creditAccountOptions = (accountsQuery.data ?? []).map((account) => ({
    label: account.name,
    value: account.id,
  }));
  const debitAccountOptions = (accountsQuery.data ?? []).map((account) => ({
    label: account.name,
    value: account.id,
  }));
  const accountTypeById = useMemo(() => Object.fromEntries(
    (accountsQuery.data ?? []).map((account) => [account.id, account.accountType as "credit" | "debit" | "neutral"])
  ), [accountsQuery.data]);

  const customerMutation = useCreateCustomer();

  const onCreateAccount = (name: string) => accountMutation.mutate({ name });
  const onCreateCategory = (name: string) => categoryMutation.mutate({ name });
  const onCreateCustomer = (name: string) => customerMutation.mutate({ name });

  const isPending =
    editMutation.isPending ||
    deleteMutation.isPending ||
    transactionQuery.isLoading ||
    categoryMutation.isPending ||
    accountMutation.isPending ||
    customerMutation.isPending;

  const isLoading =
    transactionQuery.isLoading ||
    categoryQuery.isLoading ||
    accountsQuery.isLoading;

  const onSubmit = (values: FormValues) => {
    editMutation.mutate(values, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const defaultValuesForForm: Partial<TransactionFormValues & TransactionDoubleEntryFormValues> = transactionQuery.data
    ? {
      accountId: transactionQuery.data.accountId as string,
      creditAccountId: transactionQuery.data.creditAccountId ?? undefined,
      debitAccountId: transactionQuery.data.debitAccountId ?? undefined,
      categoryId: transactionQuery.data.categoryId,
      amount: String(transactionQuery.data.amount),
      date: transactionQuery.data.date
        ? new Date(transactionQuery.data.date)
        : new Date(),
      payeeCustomerId: transactionQuery.data.payeeCustomerId ?? undefined,
      payee: transactionQuery.data.payee ?? undefined,
      notes: transactionQuery.data.notes ?? undefined,
      status: transactionQuery.data.status ?? "pending",
    }
    : {
      accountId: undefined,
      creditAccountId: "",
      debitAccountId: "",
      categoryId: null,
      amount: "0",
      date: new Date(),
      payeeCustomerId: undefined,
      payee: undefined,
      notes: undefined,
      status: "pending",
    };

  const statusOrder = ["draft", "pending", "completed", "reconciled"] as const;
  const currentStatus = transactionQuery.data?.status ?? "pending";
  const allowedStatuses = useMemo(() => {
    const idx = statusOrder.indexOf(currentStatus as typeof statusOrder[number]);
    const start = idx >= 0 ? idx : 0;
    return statusOrder.slice(start).map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value }));
  }, [currentStatus]);

  const onDelete = async () => {
    const ok = await confirm();

    if (ok) {
      deleteMutation.mutate(undefined, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const [activeTab, setActiveTab] = useState("details");
  return (
    <>
      <ConfirmDialog />
      <Sheet open={isOpen || isPending} onOpenChange={onClose}>
        <SheetContent className="flex flex-col h-full p-0 max-w-2xl">
          <div className="px-6 pt-6">
            <SheetHeader>
              <SheetTitle>Edit Transaction</SheetTitle>
              <SheetDescription>Edit an existing transaction.</SheetDescription>
            </SheetHeader>
          </div>

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="mx-6 mt-4 grid w-auto grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6">
                <TabsContent value="details" className="space-y-6 mt-6">
                  {transactionQuery.data && transactionQuery.data.accountId ? (
                <TransactionForm
                  id={id}
                  defaultValues={defaultValuesForForm as TransactionFormValues}
                  onSubmit={onSubmit}
                  disabled={isPending}
                  categoryOptions={categoryOptions}
                  onCreateCategory={onCreateCategory}
                  accountOptions={accountOptions}
                  onCreateAccount={onCreateAccount}
                  statusOptions={allowedStatuses}
                  onDelete={onDelete}
                />
                  ) : (
                <TransactionDoubleEntryForm
                  id={id}
                  defaultValues={defaultValuesForForm as TransactionDoubleEntryFormValues}
                  onSubmit={onSubmit}
                  disabled={isPending}
                  categoryOptions={categoryOptions}
                  onCreateCategory={onCreateCategory}
                  creditAccountOptions={creditAccountOptions}
                  debitAccountOptions={debitAccountOptions}
                  accountTypeById={accountTypeById}
                  onCreateAccount={onCreateAccount}
                  onCreateCustomer={onCreateCustomer}
                  onDelete={onDelete}
                  statusOptions={allowedStatuses}
                  hasPayee={!!transactionQuery.data?.payee}
                />
                  )}

              {splitGroupQuery.data && splitGroupQuery.data.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-semibold">Split group</div>
                  <div className="space-y-1 text-sm">
                    {splitGroupQuery.data.map((split) => (
                      <div key={split.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                        <div>
                          <div className="font-medium">
                            {split.splitType === "parent" ? "Parent" : "Child"}
                          </div>
                          <div className="text-xs text-muted-foreground">{split.payeeCustomerName || split.payee || ""}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(split.amount ?? 0)}</div>
                      </div>
                    ))}
                                  </TabsContent>

                                  <TabsContent value="documents" className="mt-6">
                                    {transactionQuery.data && (
                                      <DocumentsTab transactionId={transactionQuery.data.id} />
                                    )}
                                  </TabsContent>

                                  <TabsContent value="history" className="mt-6">
                  </div>
                </div>
              )}

              {statusHistoryQuery.data && statusHistoryQuery.data.length > 0 && (
                                  ? (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-sm font-semibold">Status history</div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {statusHistoryQuery.data.map((entry, idx) => (
                      <Fragment key={entry.id}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{entry.toStatus}</div>
                            <div className="text-xs">Changed by {entry.changedBy || "unknown"}</div>
                          </div>
                          <div className="text-xs">
                            {entry.changedAt ? new Date(entry.changedAt).toLocaleString() : ""}
                          </div>
                        </div>
                        {idx < statusHistoryQuery.data.length - 1 && <div className="h-px bg-muted" />}
                      </Fragment>
                    ))}
                  </div>
                </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No status history yet.</div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};