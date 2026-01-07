import { Loader2 } from "lucide-react";
import { useState } from "react";

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
import { useCreateCategory } from "@/features/categories/api/use-create-category";
import { useGetCategories } from "@/features/categories/api/use-get-categories";
import { useCreateCustomer } from "@/features/customers/api/use-create-customer";
import { useCreateUnifiedTransaction } from "@/features/transactions/api/use-create-unified-transaction";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";

import { UnifiedTransactionForm, UnifiedTransactionFormValues } from "./unified-transaction-form";

export const NewTransactionSheet = () => {
    const { isOpen, onClose, defaultValues } = useNewTransaction();
    const [activeTab, setActiveTab] = useState("details");

    const createMutation = useCreateUnifiedTransaction();
    const categoryMutation = useCreateCategory();
    const categoryQuery = useGetCategories();
    const categoryOptions = (categoryQuery.data ?? []).map((category) => ({
        label: category.name,
        value: category.id,
    }));

    const customerMutation = useCreateCustomer();

    const onCreateCategory = (name: string) => categoryMutation.mutate({ name });
    const onCreateCustomer = (name: string) => customerMutation.mutate({ name });

    const isPending =
        createMutation.isPending ||
        categoryMutation.isPending ||
        customerMutation.isPending;
    const isLoading = categoryQuery.isLoading;

    const onSubmit = (values: UnifiedTransactionFormValues) => {
        createMutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <Sheet open={isOpen || isPending} onOpenChange={onClose}>
            <SheetContent className="flex flex-col h-full p-0 max-w-xl lg:max-w-lg">
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
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <div className="px-6 mb-4">
                            <TabsList className="w-full">
                                <TabsTrigger value="details">Details</TabsTrigger>
                                <TabsTrigger value="documents">Documents</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6">
                            <TabsContent value="details" className="mt-6">
                                <UnifiedTransactionForm
                                    disabled={isPending}
                                    categoryOptions={categoryOptions}
                                    onCreateCategory={onCreateCategory}
                                    onCreateCustomer={onCreateCustomer}
                                    onSubmit={onSubmit}
                                    defaultValues={defaultValues}
                                />
                            </TabsContent>

                            <TabsContent value="documents" className="mt-6">
                                <div className="rounded-md border border-dashed p-8 text-center">
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Documents can be attached after creating the transaction
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Save this transaction first, then edit it to upload documents
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </SheetContent>
        </Sheet>
    );
};