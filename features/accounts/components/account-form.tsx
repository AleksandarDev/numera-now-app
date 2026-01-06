import { z } from "zod";
import { Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { insertAccountSchema } from "@/db/schema";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { SheetFooter } from "@/components/ui/sheet";

const formSchema = insertAccountSchema.pick({
    name: true,
    code: true,
    isOpen: true,
    isReadOnly: true,
    accountType: true,
});

type FormValues = z.input<typeof formSchema>;

type Props = {
    id?: string;
    defaultValues?: Partial<FormValues>;
    onSubmit: (values: FormValues) => void;
    onDelete?: () => void;
    disabled?: boolean;
};

export const AccountForm = ({
    id,
    defaultValues,
    onSubmit,
    onDelete,
    disabled,
}: Props) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            isOpen: true,
            isReadOnly: false,
            accountType: "neutral",
            ...defaultValues,
        },
    });

    const handleSubmit = (values: FormValues) => {
        onSubmit({
            ...values,
            code: (values.code?.length ?? 0) > 0 ? values.code : null,
        });
    };

    const handleDelete = () => {
        onDelete?.();
    }
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4 pt-4 pb-6">
                    <FormField
                        name="name"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Name
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        disabled={disabled}
                                        placeholder="e.g. Cash, Credit Card, Bank"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        name="code"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Code
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        disabled={disabled}
                                        placeholder="e.g. 0001, CASH, VISA"
                                        {...field}
                                        value={field.value || ""}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        name="accountType"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Account type
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        disabled={disabled}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="neutral">Neutral (can credit or debit)</SelectItem>
                                            <SelectItem value="debit">Debit only</SelectItem>
                                            <SelectItem value="credit">Credit only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        name="isOpen"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={disabled}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                    Account is open
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                    <FormField
                        name="isReadOnly"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={disabled}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                    Read-only account
                                </FormLabel>
                            </FormItem>
                        )}
                    />
            <SheetFooter>
                    <Button className="w-full" disabled={disabled}>
                        {id ? "Save changes" : "Create Account"}
                    </Button>
                    {!!id && <Button
                        type="button"
                        disabled={disabled}
                        onClick={handleDelete}
                        className="w-full"
                        variant="outline"
                    >
                        <Trash className="size-4 mr-2" />
                        Delete account
                    </Button>}
                </SheetFooter>
            </form>
        </Form>
    )
};