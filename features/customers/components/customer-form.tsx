import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SheetFooter } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { insertCustomerSchema } from '@/db/schema';

const formSchema = insertCustomerSchema.omit({
    userId: true,
    id: true,
    isComplete: true,
});

type FormValues = z.input<typeof formSchema>;

type Props = {
    id?: string;
    defaultValues?: FormValues;
    onSubmit: (values: FormValues) => void;
    onDelete?: () => void;
    disabled?: boolean;
};

export const CustomerForm = ({
    id,
    defaultValues,
    onSubmit,
    onDelete,
    disabled,
}: Props) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
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
                className="space-y-4 pt-4 pb-6"
            >
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name *</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="Customer name"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="pin"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>PIN</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="Personal Identification Number"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="vatNumber"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>VAT Number</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="VAT registration number"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="address"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                                <Textarea
                                    disabled={disabled}
                                    placeholder="Full address"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="contactEmail"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="email@example.com"
                                    type="email"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="contactTelephone"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contact Telephone</FormLabel>
                            <FormControl>
                                <Input
                                    disabled={disabled}
                                    placeholder="Phone number"
                                    type="tel"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    name="isOwnFirm"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    disabled={disabled}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>Mark as Own Firm</FormLabel>
                                <FormDescription>
                                    Mark this customer as your own company/firm.
                                    This will be used to automatically link Stripe
                                    payments.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />
                <SheetFooter>
                    <Button className="w-full" disabled={disabled}>
                        {id ? 'Save changes' : 'Create customer'}
                    </Button>
                    {!!id && (
                        <Button
                            type="button"
                            disabled={disabled}
                            onClick={handleDelete}
                            className="w-full"
                            variant="outline"
                        >
                            Delete customer
                        </Button>
                    )}
                </SheetFooter>
            </form>
        </Form>
    );
};
