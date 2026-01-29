import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Loader2 } from 'lucide-react';
import type { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertCustomerSchema } from '@/db/schema';
import { useDeleteCustomer } from '@/features/customers/api/use-delete-customer';
import { useEditCustomer } from '@/features/customers/api/use-edit-customer';
import { useGetCustomer } from '@/features/customers/api/use-get-customer';
import { CustomerForm } from '@/features/customers/components/customer-form';
import { CustomerIbansManager } from '@/features/customers/components/customer-ibans-manager';
import { useOpenCustomer } from '@/features/customers/hooks/use-open-customer';
import { useConfirm } from '@/hooks/use-confirm';

const formSchema = insertCustomerSchema.omit({
    userId: true,
    id: true,
    isComplete: true,
});

type FormValues = z.input<typeof formSchema>;

export const EditCustomerSheet = () => {
    const { isOpen, onClose, id } = useOpenCustomer();

    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this customer. This action cannot be undone.',
    );

    const customerQuery = useGetCustomer(id);
    const editMutation = useEditCustomer(id);
    const deleteMutation = useDeleteCustomer(id);

    const isPending = editMutation.isPending || deleteMutation.isPending;

    const isLoading = customerQuery.isLoading;

    const onSubmit = (values: FormValues) => {
        editMutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
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

    const defaultValues = customerQuery.data
        ? {
              name: customerQuery.data.name,
              pin: customerQuery.data.pin,
              vatNumber: customerQuery.data.vatNumber,
              address: customerQuery.data.address,
              contactEmail: customerQuery.data.contactEmail,
              contactTelephone: customerQuery.data.contactTelephone,
          }
        : {
              name: '',
              pin: '',
              vatNumber: '',
              address: '',
              contactEmail: '',
              contactTelephone: '',
          };

    return (
        <>
            <ConfirmDialog />
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="flex flex-col h-full p-0">
                    <div className="px-6 pt-6">
                        <SheetHeader>
                            <SheetTitle>Edit Customer</SheetTitle>
                            <SheetDescription>
                                Edit an existing customer.
                            </SheetDescription>
                        </SheetHeader>
                    </div>
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-4 text-muted-foreground animate-spin" />
                        </div>
                    ) : (
                        <Tabs
                            defaultValue="details"
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="px-6 mb-4">
                                <TabsList className="w-full">
                                    <TabsTrigger
                                        value="details"
                                        className="flex-1"
                                    >
                                        Details
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="ibans"
                                        className="flex-1"
                                    >
                                        Bank Accounts
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            <TabsContent
                                value="details"
                                className="flex-1 overflow-y-auto px-6 mt-0"
                            >
                                <CustomerForm
                                    id={id}
                                    defaultValues={defaultValues}
                                    onSubmit={onSubmit}
                                    onDelete={onDelete}
                                    disabled={isPending}
                                />
                            </TabsContent>
                            <TabsContent
                                value="ibans"
                                className="flex-1 overflow-y-auto px-6 mt-0"
                            >
                                {id ? (
                                    <CustomerIbansManager
                                        customerId={id}
                                        disabled={isPending}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center py-12">
                                        <p className="text-sm text-muted-foreground">
                                            Save the customer first to manage
                                            bank accounts.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
};
