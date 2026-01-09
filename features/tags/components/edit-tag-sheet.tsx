import { Loader2 } from 'lucide-react';
import type { z } from 'zod';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertTagSchema } from '@/db/schema';
import { useConfirm } from '@/hooks/use-confirm';
import { useDeleteTag } from '../api/use-delete-tag';
import { useEditTag } from '../api/use-edit-tag';
import { useGetTag } from '../api/use-get-tag';
import { useOpenTag } from '../hooks/use-open-tag';
import { TagForm } from './tag-form';

const formSchema = insertTagSchema.pick({
    name: true,
    color: true,
});

type FormValues = z.infer<typeof formSchema>;

export const EditTagSheet = () => {
    const { isOpen, onClose, id } = useOpenTag();

    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this tag.',
    );

    const tagQuery = useGetTag(id);
    const editMutation = useEditTag(id);
    const deleteMutation = useDeleteTag(id);

    const isPending = editMutation.isPending || deleteMutation.isPending;

    const isLoading = tagQuery.isLoading;

    const onSubmit = (values: FormValues) => {
        editMutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    const defaultValues = tagQuery.data
        ? {
              name: tagQuery.data.name,
              color: tagQuery.data.color,
          }
        : {
              name: '',
              color: '#3b82f6',
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

    return (
        <>
            <ConfirmDialog />
            <Sheet open={isOpen || isPending} onOpenChange={onClose}>
                <SheetContent className="flex flex-col h-full p-0">
                    <div className="px-6 pt-6">
                        <SheetHeader>
                            <SheetTitle>Edit Tag</SheetTitle>

                            <SheetDescription>
                                Edit an existing tag.
                            </SheetDescription>
                        </SheetHeader>
                    </div>

                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-6">
                            <TagForm
                                id={id}
                                defaultValues={defaultValues}
                                onSubmit={onSubmit}
                                disabled={isPending}
                                onDelete={onDelete}
                            />
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
};
