'use client';

import { Typography } from '@signalco/ui-primitives/Typography';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { useGetCustomer } from '@/features/customers/api/use-get-customer';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { useNewCustomer } from '@/features/customers/hooks/use-new-customer';
import { useGetSuggestedCustomers } from '@/features/transactions/api/use-get-suggested-customers';

export type CustomerSelectProps = {
    value?: string;
    onChange: (newValue?: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    onCreate?: (name: string) => Promise<string | undefined>;
    suggestionQuery?: string;
    /** Notes text used for suggesting customers based on transaction history */
    suggestionNotes?: string;
};

export const CustomerSelect = ({
    value,
    onChange,
    className,
    placeholder = 'Select customer...',
    disabled,
    onCreate,
    suggestionQuery,
    suggestionNotes,
}: CustomerSelectProps) => {
    const [open, setOpen] = useState(false);
    const [customerFilter, setCustomerFilter] = useState('');

    const { onOpen: onOpenNewCustomer } = useNewCustomer();
    const { data: customers, isLoading: isLoadingCustomers } =
        useGetCustomers();

    const selectedCustomerFromList = useMemo(() => {
        if (!value || !customers) return null;
        return customers.find((customer) => customer.id === value) ?? null;
    }, [customers, value]);
    const shouldFetchSelectedCustomer =
        !!value && (!customers || !selectedCustomerFromList);
    const selectedCustomerQuery = useGetCustomer(value, {
        enabled: shouldFetchSelectedCustomer,
    });
    const selectedCustomer =
        selectedCustomerFromList ?? selectedCustomerQuery.data ?? null;

    const normalizedSelectedCustomer = useMemo(() => {
        if (!selectedCustomer) return null;
        return {
            ...selectedCustomer,
            transactionCount:
                (
                    selectedCustomer as {
                        transactionCount?: number;
                    }
                ).transactionCount ?? 0,
        };
    }, [selectedCustomer]);

    const resolvedSuggestionQuery = useMemo(() => {
        const trimmedFilter = customerFilter.trim();
        if (trimmedFilter.length > 0) {
            return trimmedFilter;
        }
        return suggestionQuery?.trim() ?? '';
    }, [customerFilter, suggestionQuery]);

    const resolvedSuggestionNotes = useMemo(() => {
        // Don't use notes when user is filtering manually
        const trimmedFilter = customerFilter.trim();
        if (trimmedFilter.length > 0) {
            return '';
        }
        return suggestionNotes?.trim() ?? '';
    }, [customerFilter, suggestionNotes]);

    const suggestedCustomersQuery = useGetSuggestedCustomers(
        resolvedSuggestionQuery,
        resolvedSuggestionNotes,
        {
            enabled: open,
        },
    );
    const suggestedCustomerIds = useMemo(
        () =>
            suggestedCustomersQuery.data?.map(
                (suggestion) => suggestion.customerId,
            ) ?? [],
        [suggestedCustomersQuery.data],
    );

    const suggestedIdOrder = useMemo(
        () =>
            new Map(
                suggestedCustomerIds.map((customerId, index) => [
                    customerId,
                    index,
                ]),
            ),
        [suggestedCustomerIds],
    );

    const filteredCustomers = useMemo(() => {
        let result =
            customers
                ?.filter((customer) => {
                    const filter = customerFilter.toLowerCase();
                    return (
                        customer.name.toLowerCase().includes(filter) ||
                        customer.pin?.toLowerCase().includes(filter)
                    );
                })
                .map((customer) => ({
                    ...customer,
                    transactionCount:
                        (
                            customer as {
                                transactionCount?: number;
                            }
                        ).transactionCount ?? 0,
                })) ?? [];

        if (
            normalizedSelectedCustomer &&
            customerFilter.trim().length === 0 &&
            !result.some(
                (customer) => customer.id === normalizedSelectedCustomer.id,
            )
        ) {
            result = [normalizedSelectedCustomer, ...result];
        }

        if (suggestedIdOrder.size > 0) {
            const suggested = result
                .filter((customer) => suggestedIdOrder.has(customer.id))
                .sort(
                    (a, b) =>
                        (suggestedIdOrder.get(a.id) ?? 0) -
                        (suggestedIdOrder.get(b.id) ?? 0),
                );
            const remaining = result.filter(
                (customer) => !suggestedIdOrder.has(customer.id),
            );
            result = [...suggested, ...remaining];
        }

        return result;
    }, [
        customers,
        customerFilter,
        normalizedSelectedCustomer,
        suggestedIdOrder,
    ]);

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredCustomers?.length ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 35,
    });

    const handleCreate = async (name: string) => {
        if (onCreate) {
            try {
                const createdId = await onCreate(name);
                if (createdId) {
                    onChange(createdId);
                }
            } catch (error) {
                console.error('Failed to create customer from picker.', error);
            }
            return;
        }

        onOpenNewCustomer();
    };

    const handleValueChange = (newValue?: string) => {
        // If Select is trying to clear the value but we have a valid value set,
        // and the dropdown is not open, ignore it (this happens when value is set
        // but the customer data hasn't loaded yet)
        if (!newValue && value && !open) {
            return;
        }
        onChange(newValue);
    };

    return (
        <Select
            open={open}
            onOpenChange={setOpen}
            value={value || ''}
            onValueChange={handleValueChange}
            disabled={disabled}
        >
            <SelectTrigger className={clsx('pl-3 pr-2', className)}>
                <div className="flex items-center justify-between w-full">
                    <span
                        className={clsx(
                            'truncate',
                            !selectedCustomer && 'text-muted-foreground',
                        )}
                    >
                        {selectedCustomer ? (
                            <div className="flex items-center gap-2">
                                <span>{selectedCustomer.name}</span>
                                {!selectedCustomer.isComplete && (
                                    <span className="text-xs text-orange-600 font-medium">
                                        (Incomplete)
                                    </span>
                                )}
                            </div>
                        ) : (
                            placeholder
                        )}
                    </span>
                </div>
            </SelectTrigger>
            <SelectContent
                className="p-0 min-w-[320px]"
                style={{
                    width: 'max(var(--radix-select-trigger-width), 320px)',
                }}
            >
                <div className="p-2 border-b">
                    <Input
                        placeholder="Search customers..."
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                        className="h-8"
                    />
                </div>
                <div className="p-2 border-b">
                    <Button
                        onClick={() => {
                            void handleCreate(customerFilter);
                            setOpen(false);
                        }}
                        variant="ghost"
                        className="w-full justify-start h-8"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create new customer
                    </Button>
                </div>
                <div ref={parentRef} className="h-[200px] overflow-auto">
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((item) => {
                            const customer = filteredCustomers?.[item.index];
                            if (!customer) return null;
                            const isSuggested = suggestedIdOrder.has(
                                customer.id,
                            );

                            return (
                                <SelectItem
                                    key={customer.id}
                                    value={customer.id}
                                    className={clsx('cursor-pointer', {
                                        'data-[state=checked]:bg-accent':
                                            value === customer.id,
                                    })}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${item.size}px`,
                                        transform: `translateY(${item.start}px)`,
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-medium truncate">
                                                {customer.name}
                                            </span>
                                            {customer.pin && (
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    ({customer.pin})
                                                </span>
                                            )}
                                            {!customer.isComplete && (
                                                <span className="text-xs text-orange-600 font-medium whitespace-nowrap">
                                                    (Incomplete)
                                                </span>
                                            )}
                                        </div>
                                        {isSuggested && (
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                Suggested
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            );
                        })}
                    </div>
                </div>
                {isLoadingCustomers && (
                    <div className="p-4 text-center">
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Loading customers...
                        </Typography>
                    </div>
                )}
                {!isLoadingCustomers &&
                    (!filteredCustomers || filteredCustomers.length === 0) && (
                        <div className="p-4 text-center">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                No customers found
                            </Typography>
                        </div>
                    )}
                {customerFilter &&
                    !isLoadingCustomers &&
                    filteredCustomers &&
                    filteredCustomers.length === 0 && (
                        <div className="p-2">
                            <Button
                                onClick={() => {
                                    void handleCreate(customerFilter);
                                    setOpen(false);
                                }}
                                variant="ghost"
                                className="w-full justify-start h-8"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Create "{customerFilter}"
                            </Button>
                        </div>
                    )}
            </SelectContent>
        </Select>
    );
};
