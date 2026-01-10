import { zodResolver } from '@hookform/resolvers/zod';
import { Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { insertTagSchema } from '@/db/schema';

const formSchema = insertTagSchema.pick({
    name: true,
    color: true,
    tagType: true,
});

type FormValues = z.infer<typeof formSchema>;

type TagFormProps = {
    id?: string;
    defaultValues?: FormValues;
    onSubmit: (values: FormValues) => void;
    onDelete?: () => void;
    disabled?: boolean;
};

export const TagForm = ({
    id,
    defaultValues,
    onSubmit,
    onDelete,
    disabled,
}: TagFormProps) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues,
    });

    const handleSubmit = (values: FormValues) => {
        onSubmit(values);
    };

    const handleDelete = () => {
        onDelete?.();
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                autoCapitalize="off"
                autoComplete="off"
                className="space-y-4 pt-4 pb-6"
            >
                <FormField
                    name="name"
                    control={form.control}
                    disabled={disabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>

                            <FormControl>
                                <Input
                                    placeholder="e.g. Business, Personal, Travel, etc."
                                    {...field}
                                />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    name="color"
                    control={form.control}
                    disabled={disabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Color (Optional)</FormLabel>

                            <FormControl>
                                <Input
                                    type="color"
                                    placeholder="#000000"
                                    {...field}
                                    value={field.value ?? '#3b82f6'}
                                />
                            </FormControl>

                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    name="tagType"
                    control={form.control}
                    disabled={disabled}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tag Type</FormLabel>

                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={disabled}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tag type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="general">
                                        General
                                    </SelectItem>
                                    <SelectItem value="source">
                                        Source
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            <FormMessage />
                        </FormItem>
                    )}
                />

                <SheetFooter>
                    <Button className="w-full" disabled={disabled}>
                        {id ? 'Save changes' : 'Create tag'}
                    </Button>

                    {!!id && (
                        <Button
                            type="button"
                            disabled={disabled}
                            onClick={handleDelete}
                            className="w-full"
                            variant="outline"
                        >
                            <Trash className="mr-2 size-4" />
                            Delete tag
                        </Button>
                    )}
                </SheetFooter>
            </form>
        </Form>
    );
};
