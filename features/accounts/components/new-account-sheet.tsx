import type { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertAccountSchema } from '@/db/schema';
import { useCreateAccount } from '@/features/accounts/api/use-create-account';
import { AccountForm } from '@/features/accounts/components/account-form';
import { useNewAccount } from '@/features/accounts/hooks/use-new-accounts';

const formSchema = insertAccountSchema.pick({
    name: true,
    code: true,
    isOpen: true,
    isReadOnly: true,
    accountType: true,
});

type FormValues = z.input<typeof formSchema>;

export const NewAccountSheet = () => {
    const { isOpen, onClose } = useNewAccount();

    const mutation = useCreateAccount();

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="flex flex-col h-full p-0">
                <div className="px-6 pt-6">
                    <SheetHeader>
                        <SheetTitle>New Account</SheetTitle>
                        <SheetDescription>
                            Create a new account to track your transactions.
                        </SheetDescription>
                    </SheetHeader>
                </div>
                <div className="flex-1 overflow-y-auto px-6">
                    <AccountForm
                        onSubmit={onSubmit}
                        disabled={mutation.isPending}
                        defaultValues={{
                            name: '',
                            code: '',
                            isOpen: true,
                            isReadOnly: false,
                            accountType: 'neutral',
                        }}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};
