import { z } from "zod";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { insertCustomerSchema } from "@/db/schema";
import { useCreateCustomer } from "@/features/customers/api/use-create-customer";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useNewCustomer } from "@/features/customers/hooks/use-new-customer";

const formSchema = insertCustomerSchema.omit({
    userId: true,
    id: true,
    isComplete: true,
});

type FormValues = z.input<typeof formSchema>;

export const NewCustomerSheet = () => {
    const { isOpen, onClose } = useNewCustomer();

    const createMutation = useCreateCustomer();

    const onSubmit = (values: FormValues) => {
        createMutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="space-y-4">
                <SheetHeader>
                    <SheetTitle>New Customer</SheetTitle>
                    <SheetDescription>
                        Create a new customer to assign to transactions.
                    </SheetDescription>
                </SheetHeader>
                <CustomerForm
                    onSubmit={onSubmit}
                    disabled={createMutation.isPending}
                    defaultValues={{
                        name: "",
                        pin: "",
                        vatNumber: "",
                        address: "",
                        contactEmail: "",
                        contactTelephone: "",
                    }}
                />
            </SheetContent>
        </Sheet>
    );
};
