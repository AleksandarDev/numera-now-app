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
import { useCreateCustomer } from "@/features/customers/api/use-create-customer";
import { useCreateTransaction } from "@/features/transactions/api/use-create-transaction";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";

import { TransactionForm } from "./transaction-form";
import { TransactionDoubleEntryForm } from "./transaction-double-entry-form";

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;

export const NewTransactionSheet = () => {
    const { doubleEntry, isOpen, onClose } = useNewTransaction();

    const createMutation = useCreateTransaction();
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
    const creditAccountOptions = (accountsQuery.data ?? []).map((account) => ({
        label: account.name,
        value: account.id,
    }));
    const debitAccountOptions = (accountsQuery.data ?? []).map((account) => ({
        label: account.name,
        value: account.id,
    }));

    const customerMutation = useCreateCustomer();

    const onCreateAccount = (name: string) => accountMutation.mutate({ name });
    const onCreateCategory = (name: string) => categoryMutation.mutate({ name });
    const onCreateCustomer = (name: string) => customerMutation.mutate({ name });

    const isPending =
        createMutation.isPending ||
        categoryMutation.isPending ||
        accountMutation.isPending ||
        customerMutation.isPending;
    const isLoading = categoryQuery.isLoading || accountsQuery.isLoading;

    const onSubmit = (values: FormValues) => {
        createMutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <Sheet open={isOpen || isPending} onOpenChange={onClose}>
            <SheetContent className="flex flex-col h-full p-0">
                <div className="px-6 pt-6">
                    <SheetHeader>
                        <SheetTitle>New Transaction</SheetTitle>

                        <SheetDescription>Add a new transaction.</SheetDescription>
                    </SheetHeader>
                </div>

                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6">
                        {doubleEntry ? (
                            <TransactionDoubleEntryForm
                                onSubmit={onSubmit}
                                disabled={isPending}
                                categoryOptions={categoryOptions}
                                onCreateCategory={onCreateCategory}
                                creditAccountOptions={creditAccountOptions}
                                debitAccountOptions={debitAccountOptions}
                                onCreateAccount={onCreateAccount}
                                onCreateCustomer={onCreateCustomer}
                                defaultValues={{
                                    date: new Date(),
                                    amount: "",
                                    notes: "",
                                    creditAccountId: "",
                                    debitAccountId: "",
                                }}
                            />
                        ) : (
                            <TransactionForm
                                onSubmit={onSubmit}
                                disabled={isPending}
                                categoryOptions={categoryOptions}
                                onCreateCategory={onCreateCategory}
                                accountOptions={accountOptions}
                                onCreateAccount={onCreateAccount}
                                defaultValues={{
                                    date: new Date(),
                                    payeeCustomerId: "",
                                    amount: "",
                                    notes: "",
                                    accountId: "",
                                }}
                            />
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};