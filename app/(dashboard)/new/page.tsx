'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateCategory } from '@/features/categories/api/use-create-category';
import { useGetCategories } from '@/features/categories/api/use-get-categories';
import { useCreateCustomer } from '@/features/customers/api/use-create-customer';
import { useCreateUnifiedTransaction } from '@/features/transactions/api/use-create-unified-transaction';

import {
    UnifiedTransactionForm,
    type UnifiedTransactionFormValues,
} from '@/features/transactions/components/unified-transaction-form';

function NewTransactionContent() {
    const router = useRouter();

    const createMutation = useCreateUnifiedTransaction();
    const categoryMutation = useCreateCategory();
    const categoryQuery = useGetCategories();
    const categoryOptions = (categoryQuery.data ?? []).map((category) => ({
        label: category.name,
        value: category.id,
    }));

    const customerMutation = useCreateCustomer();

    const onCreateCategory = (name: string) =>
        categoryMutation.mutate({ name });
    const onCreateCustomer = (name: string) =>
        customerMutation
            .mutateAsync({ name })
            .then((response) => {
                if ('data' in response) {
                    return response.data.id;
                }

                throw new Error(response.error ?? 'Failed to create customer.');
            });

    const isPending =
        createMutation.isPending ||
        categoryMutation.isPending ||
        customerMutation.isPending;
    const isLoading = categoryQuery.isLoading;

    const onSubmit = (values: UnifiedTransactionFormValues) => {
        createMutation.mutate(values, {
            onSuccess: () => {
                router.push('/transactions');
            },
        });
    };

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
                        <UnifiedTransactionForm
                            disabled={isPending}
                            categoryOptions={categoryOptions}
                            onCreateCategory={onCreateCategory}
                            onCreateCustomer={onCreateCustomer}
                            onSubmit={onSubmit}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
                    <Card>
                        <CardContent className="flex h-[500px] w-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-slate-300" />
                        </CardContent>
                    </Card>
                </div>
            }
        >
            <NewTransactionContent />
        </Suspense>
    );
}
