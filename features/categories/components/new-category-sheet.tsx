import type { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { insertCategorySchema } from '@/db/schema';
import { useCreateCategory } from '@/features/categories/api/use-create-category';
import { CategoryForm } from '@/features/categories/components/category-form';
import { useNewCategory } from '@/features/categories/hooks/use-new-category';

const formSchema = insertCategorySchema.pick({
    name: true,
});

type FormValues = z.infer<typeof formSchema>;

export const NewCategorySheet = () => {
    const { isOpen, onClose } = useNewCategory();
    const mutation = useCreateCategory();

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
                        <SheetTitle>New Category</SheetTitle>

                        <SheetDescription>
                            Create a new category to organize your transactions.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6">
                    <CategoryForm
                        defaultValues={{
                            name: '',
                        }}
                        onSubmit={onSubmit}
                        disabled={mutation.isPending}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};
