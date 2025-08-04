import { Loader2 } from "lucide-react";
import { z } from "zod";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { insertTransactionSchema } from "@/db/schema";
import { useCreateAccount } from "@/features/accounts/api/use-create-account";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useCreateCategory } from "@/features/categories/api/use-create-category";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useDeleteTransaction } from "@/features/transactions/api/use-delete-transaction";
import { useEditTransaction } from "@/features/transactions/api/use-edit-transaction";
import { useGetTransaction } from "@/features/transactions/api/use-get-transaction";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { useConfirm } from "@/hooks/use-confirm";

import { TransactionForm } from "./transaction-form";
import { TransactionDoubleEntryForm } from "./transaction-double-entry-form";

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;

export const EditTransactionSheet = () => {
  const { isOpen, onClose, id } = useOpenTransaction();

  const [ConfirmDialog, confirm] = useConfirm(
    "Are you sure?",
    "You are about to delete this transaction."
  );

  const transactionQuery = useGetTransaction(id);
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

  const onCreateAccount = (name: string) => accountMutation.mutate({ name });
  const onCreateCategory = (name: string) => categoryMutation.mutate({ name });

  const isPending =
    editMutation.isPending ||
    deleteMutation.isPending ||
    transactionQuery.isLoading ||
    categoryMutation.isPending ||
    accountMutation.isPending;

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

  const defaultValues = transactionQuery.data
    ? {
      accountId: transactionQuery.data.accountId ?? undefined,
      creditAccountId: transactionQuery.data.creditAccountId ?? undefined,
      debitAccountId: transactionQuery.data.debitAccountId ?? undefined,
      categoryId: transactionQuery.data.categoryId,
      amount: transactionQuery.data.amount.toString(),
      date: transactionQuery.data.date
        ? new Date(transactionQuery.data.date)
        : new Date(),
      payeeCustomerId: transactionQuery.data.payeeCustomerId ?? "",
      notes: transactionQuery.data.notes,
    }
    : {
      accountId: "",
      creditAccountId: "",
      debitAccountId: "",
      categoryId: "",
      amount: "",
      date: new Date(),
      payeeCustomerId: "",
      notes: "",
    };

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

  return (
    <>
      <ConfirmDialog />
      <Sheet open={isOpen || isPending} onOpenChange={onClose}>
        <SheetContent className="space-y-4">
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>

            <SheetDescription>Edit an existing transaction.</SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {transactionQuery.data && transactionQuery.data.accountId ? (
                <TransactionForm
                  id={id}
                  defaultValues={defaultValues}
                  onSubmit={onSubmit}
                  disabled={isPending}
                  categoryOptions={categoryOptions}
                  onCreateCategory={onCreateCategory}
                  accountOptions={accountOptions}
                  onCreateAccount={onCreateAccount}
                  onDelete={onDelete}
                />
              ) : (
                <TransactionDoubleEntryForm
                  id={id}
                  defaultValues={defaultValues}
                  onSubmit={onSubmit}
                  disabled={isPending}
                  categoryOptions={categoryOptions}
                  onCreateCategory={onCreateCategory}
                  creditAccountOptions={creditAccountOptions}
                  debitAccountOptions={debitAccountOptions}
                  onCreateAccount={onCreateAccount}
                  onDelete={onDelete} />
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};