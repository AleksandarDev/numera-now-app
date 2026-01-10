import type { z } from 'zod';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertTagSchema } from '@/db/schema';
import { useCreateTag } from '@/features/tags/api/use-create-tag';
import { TagForm } from '@/features/tags/components/tag-form';
import { useNewTag } from '@/features/tags/hooks/use-new-tag';

const formSchema = insertTagSchema.pick({
    name: true,
    color: true,
    tagType: true,
});

type FormValues = z.infer<typeof formSchema>;

export const NewTagSheet = () => {
    const { isOpen, onClose } = useNewTag();
    const mutation = useCreateTag();

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <Sheet open={isOpen || mutation.isPending} onOpenChange={onClose}>
            <SheetContent className="flex flex-col h-full p-0">
                <div className="px-6 pt-6">
                    <SheetHeader>
                        <SheetTitle>New Tag</SheetTitle>

                        <SheetDescription>
                            Create a new tag to organize your transactions.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6">
                    <TagForm
                        defaultValues={{
                            name: '',
                            color: '#3b82f6',
                            tagType: 'general' as const,
                        }}
                        onSubmit={onSubmit}
                        disabled={mutation.isPending}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};
