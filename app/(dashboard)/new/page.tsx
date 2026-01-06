"use client";

import { Loader2, ArrowLeft, Split } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { insertTransactionSchema } from "@/db/schema";
import { useCreateAccount } from "@/features/accounts/api/use-create-account";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useCreateCategory } from "@/features/categories/api/use-create-category";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useCreateCustomer } from "@/features/customers/api/use-create-customer";
import { useCreateTransaction } from "@/features/transactions/api/use-create-transaction";
import { useGetSettings } from "@/features/settings/api/use-get-settings";

import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { TransactionDoubleEntryForm } from "@/features/transactions/components/transaction-double-entry-form";
import { SplitTransactionForm, SplitTransactionFormValues } from "@/features/transactions/components/split-transaction-form";

const formSchema = insertTransactionSchema.omit({ id: true });

type FormValues = z.infer<typeof formSchema>;

function NewTransactionContent() {
    const router = useRouter();
    const [splitMode, setSplitMode] = useState(false);

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
    const settingsQuery = useGetSettings();
    const doubleEntryMode = settingsQuery.data?.doubleEntryMode ?? false;

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
                setSplitMode(false);
                router.push("/transactions");
            },
        });
    };

    const splitDefaults: SplitTransactionFormValues = useMemo(() => ({
        date: new Date(),
        payeeCustomerId: undefined,
        payee: undefined,
        notes: "",
        categoryId: undefined,
        doubleEntry: !!doubleEntryMode,
        splits: [
            { amount: "", accountId: "", creditAccountId: "", debitAccountId: "", categoryId: "", notes: "" },
            { amount: "", accountId: "", creditAccountId: "", debitAccountId: "", categoryId: "", notes: "" },
        ],
    }), [doubleEntryMode]);

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="size-4" />
                        </Button>
                        <CardTitle>New Transaction</CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex h-[500px] w-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2">
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
                                    <Split className="mr-2 size-4" /> Split
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
                                        setSplitMode(false);
                                        router.push("/transactions");
                                    }}
                                />
                            ) : doubleEntryMode ? (
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
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={
            <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
                <Card>
                    <CardContent className="flex h-[500px] w-full items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-slate-300" />
                    </CardContent>
                </Card>
            </div>
        }>
            <NewTransactionContent />
        </Suspense>
    );
}
