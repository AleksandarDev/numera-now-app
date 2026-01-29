'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { InvoiceImport } from '@/components/invoice-import';
import { useCreateCustomer } from '@/features/customers/api/use-create-customer';
import { useCreateTag } from '@/features/tags/api/use-create-tag';
import { useGetTags } from '@/features/tags/api/use-get-tags';
import { useCreateUnifiedTransaction } from '@/features/transactions/api/use-create-unified-transaction';
import {
    UnifiedTransactionForm,
    type UnifiedTransactionFormValues,
} from '@/features/transactions/components/unified-transaction-form';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';

function NewTransactionContent() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('details');
    const { onOpen: onOpenTransaction } = useOpenTransaction();

    const createMutation = useCreateUnifiedTransaction();
    const tagMutation = useCreateTag();
    const tagQuery = useGetTags();
    const tagOptions = (tagQuery.data ?? []).map((tag) => ({
        label: tag.name,
        value: tag.id,
        color: tag.color,
    }));

    const customerMutation = useCreateCustomer();

    const onCreateTag = (name: string) => tagMutation.mutate({ name });
    const onCreateCustomer = (name: string) =>
        customerMutation.mutateAsync({ name }).then((response) => {
            if ('data' in response) {
                return response.data.id;
            }

            throw new Error(response.error ?? 'Failed to create customer.');
        });

    const isPending =
        createMutation.isPending ||
        tagMutation.isPending ||
        customerMutation.isPending;
    const isLoading = tagQuery.isLoading;

    const onSubmit = (values: UnifiedTransactionFormValues) => {
        createMutation.mutate(values, {
            onSuccess: () => {
                router.push('/transactions');
            },
        });
    };

    const handleImportComplete = () => {
        router.push('/transactions');
    };

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="plain"
                            className="h-8 w-8 p-0"
                            onClick={() => router.back()}
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
                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full"
                        >
                            <TabsList className="w-full max-w-md">
                                <TabsTrigger value="details" className="flex-1">
                                    Manual Entry
                                </TabsTrigger>
                                <TabsTrigger value="import" className="flex-1">
                                    Import from ZIP
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="details" className="mt-6">
                                <UnifiedTransactionForm
                                    disabled={isPending}
                                    tagOptions={tagOptions}
                                    onCreateTag={onCreateTag}
                                    onCreateCustomer={onCreateCustomer}
                                    onSubmit={onSubmit}
                                />
                            </TabsContent>

                            <TabsContent value="import" className="mt-6">
                                <InvoiceImport
                                    onComplete={handleImportComplete}
                                    onOpenTransaction={onOpenTransaction}
                                />
                            </TabsContent>
                        </Tabs>
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
