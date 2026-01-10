import { Loader2 } from 'lucide-react';
import type { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertAccountSchema } from '@/db/schema';
import { useDeleteAccount } from '@/features/accounts/api/use-delete-account';
import { useEditAccount } from '@/features/accounts/api/use-edit-account';
import { useGetAccount } from '@/features/accounts/api/use-get-account';
import { AccountForm } from '@/features/accounts/components/account-form';
import { useOpenAccount } from '@/features/accounts/hooks/use-open-account';
import { useConfirm } from '@/hooks/use-confirm';

const formSchema = insertAccountSchema.pick({
    name: true,
    code: true,
    isOpen: true,
    isReadOnly: true,
    accountType: true,
    accountClass: true,
    openingBalance: true,
});

type FormValues = z.input<typeof formSchema>;

export const EditAccountSheet = () => {
    const { isOpen, onClose, id } = useOpenAccount();

    const [ConfirmationDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this account.',
    );

    const accountQuery = useGetAccount(id);
    const editMutation = useEditAccount(id);
    const deleteMutation = useDeleteAccount(id);

    const isPending = editMutation.isPending || deleteMutation.isPending;

    const isLoading = accountQuery.isLoading;

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

    const defaultValues = accountQuery.data
        ? {
              name: accountQuery.data.name,
              code: accountQuery.data.code,
              isOpen: accountQuery.data.isOpen,
              isReadOnly: accountQuery.data.isReadOnly,
              accountType: accountQuery.data.accountType,
              accountClass: accountQuery.data.accountClass,
              openingBalance: accountQuery.data.openingBalance,
          }
        : {
              name: '',
              code: null,
              isOpen: true,
              isReadOnly: false,
              accountType: 'neutral' as const,
              accountClass: undefined,
              openingBalance: 0,
          };

    return (
        <>
            <ConfirmationDialog />
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="flex flex-col h-full p-0">
                    <div className="px-6 pt-6">
                        <SheetHeader>
                            <SheetTitle>Edit Account</SheetTitle>
                            <SheetDescription>
                                Edit the account details.
                            </SheetDescription>
                        </SheetHeader>
                    </div>
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-4 text-muted-foreground animate-spin" />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-6">
                            <AccountForm
                                key={id}
                                id={id}
                                onSubmit={onSubmit}
                                disabled={isPending}
                                defaultValues={defaultValues}
                                onDelete={onDelete}
                            />
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
};
