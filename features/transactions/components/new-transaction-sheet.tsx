import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { SplitTransactionForm, SplitTransactionFormValues } from "./split-transaction-form";

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;

export const NewTransactionSheet = () => {
    const { doubleEntry, isOpen, onClose, splitMode: initialSplitMode, prefillSplit } = useNewTransaction();
    const [splitMode, setSplitMode] = useState(initialSplitMode);

    useEffect(() => {
        if (isOpen) {
            setSplitMode(initialSplitMode);
        }
    }, [isOpen, initialSplitMode]);

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
    const accountTypeById = useMemo(() => Object.fromEntries(
        (accountsQuery.data ?? []).map((account) => [account.id, account.accountType as "credit" | "debit" | "neutral"])
    ), [accountsQuery.data]);

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
                setSplitMode(false);
            },
        });
    };

    const splitDefaults: SplitTransactionFormValues = useMemo(() => ({
        date: prefillSplit?.date ?? new Date(),
        status: prefillSplit?.status ?? "pending",
        payeeCustomerId: prefillSplit?.payeeCustomerId,
        payee: prefillSplit?.payee,
        notes: prefillSplit?.notes ?? "",
        categoryId: prefillSplit?.categoryId ?? undefined,
        doubleEntry: !!doubleEntry,
        splits: [
            { amount: "", accountId: "", creditAccountId: "", debitAccountId: "", categoryId: "", notes: "" },
            { amount: "", accountId: "", creditAccountId: "", debitAccountId: "", categoryId: "", notes: "" },
        ],
    }), [prefillSplit, doubleEntry]);

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
                        <div className="mb-4 flex gap-2">
                            <Button
                                variant={splitMode ? "outline" : "default"}
                                onClick={() => setSplitMode(false)}
                                size="sm"
                            >
                                Single
                            </Button>
                            <Button
                                variant={splitMode ? "default" : "outline"}
                                onClick={() => setSplitMode(true)}
                                size="sm"
                            >
                                Split
                            </Button>
                        </div>

                        {splitMode ? (
                            <SplitTransactionForm
                                disabled={isPending}
                                categoryOptions={categoryOptions}
                                onCreateCategory={onCreateCategory}
                                onCreateCustomer={onCreateCustomer}
                                defaultValues={splitDefaults}
                                onSuccess={() => {
                                    onClose();
                                    setSplitMode(false);
                                }}
                            />
                        ) : doubleEntry ? (
                            <TransactionDoubleEntryForm
                                onSubmit={onSubmit}
                                disabled={isPending}
                                categoryOptions={categoryOptions}
                                onCreateCategory={onCreateCategory}
                                creditAccountOptions={creditAccountOptions}
                                debitAccountOptions={debitAccountOptions}
                                accountTypeById={accountTypeById}
                                onCreateAccount={onCreateAccount}
                                onCreateCustomer={onCreateCustomer}
                                defaultValues={{
                                    date: new Date(),
                                    amount: "",
                                    notes: "",
                                    creditAccountId: "",
                                    debitAccountId: "",
                                    status: "pending",
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
                                    status: "pending",
                                }}
                            />
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};