'use client';

import { Typography } from '@signalco/ui-primitives/Typography';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';
import { cn } from '@/lib/utils';
import { AccountName } from './account-name';
import { Input } from './ui/input';

export type AccountSelectProps = {
    value: string;
    onChange: (newValue: string) => void;
    selectAll?: boolean;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    showClosed?: boolean;
    excludeReadOnly?: boolean;
    allowedTypes?: Array<'credit' | 'debit' | 'neutral'>;
    suggestedAccountIds?: string[];
    onOpenChange?: (open: boolean) => void;
};

export const AccountSelect = ({
    value,
    onChange,
    selectAll,
    className,
    placeholder,
    disabled,
    showClosed = false,
    excludeReadOnly = false,
    allowedTypes,
    suggestedAccountIds,
    onOpenChange,
}: AccountSelectProps) => {
    const [open, setOpen] = useState(false);
    const [accountsFilter, setAccountsFilter] = useState('');

    const suggestedIdOrder = useMemo(
        () =>
            new Map(
                (suggestedAccountIds ?? [])
                    .filter(Boolean)
                    .map((accountId, index) => [accountId, index]),
            ),
        [suggestedAccountIds],
    );

    // TODO: Don't load all accounts if filter is not open, load only the selected one
    const { data: accounts, isLoading: isLoadingAccounts } = useGetAccounts({
        pageSize: 9999,
        accountId: null,
        showClosed,
    });

    const resolvedAccounts = useMemo(() => {
        let result = accounts ?? [];

        // Filter out read-only accounts if needed
        if (excludeReadOnly) {
            result = result.filter((account) => !account.isReadOnly);
        }

        if (allowedTypes && allowedTypes.length > 0) {
            result = result.filter((account) => {
                const type = (account.accountType ?? 'neutral') as
                    | 'credit'
                    | 'debit'
                    | 'neutral';
                return allowedTypes.includes(type);
            });
        }

        if (suggestedIdOrder.size > 0) {
            const suggested = result
                .filter((account) => suggestedIdOrder.has(account.id))
                .sort(
                    (a, b) =>
                        (suggestedIdOrder.get(a.id) ?? 0) -
                        (suggestedIdOrder.get(b.id) ?? 0),
                );
            const remaining = result.filter(
                (account) => !suggestedIdOrder.has(account.id),
            );
            result = [...suggested, ...remaining];
        }

        // Add "all" option if needed
        if (selectAll) {
            result = [
                {
                    id: 'all',
                    name: 'All accounts',
                    code: '',
                    isOpen: true,
                    isReadOnly: false,
                    accountType: 'neutral' as const,
                    hasInvalidConfig: false,
                },
                ...result,
            ];
        }

        return result;
    }, [
        accounts,
        selectAll,
        excludeReadOnly,
        allowedTypes,
        suggestedAccountIds,
    ]);
    const filteredAccounts = useMemo(
        () =>
            resolvedAccounts?.filter((account) => {
                const filter = accountsFilter.toLowerCase();
                return (
                    account.name.toLowerCase().includes(filter) ||
                    account.code?.toLowerCase().includes(filter)
                );
            }),
        [resolvedAccounts, accountsFilter],
    );

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: (filteredAccounts ?? []).length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        enabled: !isLoadingAccounts && open,
        initialOffset:
            (filteredAccounts?.findIndex((account) => account.id === value) ??
                0) * 45,
    });

    // Find selected account from all accounts (not just resolved/filtered ones) so we can display it even if invalid
    const selectedAccount =
        (value?.length ?? 0) > 0 && accounts
            ? accounts.find((account) => account.id === value)
            : null;

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };

    const shouldRefocus = useRef(false);
    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={isLoadingAccounts || disabled}
            open={open}
            onOpenChange={handleOpenChange}
        >
            <SelectTrigger className={cn('text-left', className)}>
                {selectedAccount ? (
                    <AccountName
                        account={selectedAccount?.name}
                        accountCode={selectedAccount?.code}
                    />
                ) : (
                    <span>{placeholder ?? 'Select account'}</span>
                )}
            </SelectTrigger>
            <SelectContent
                viewportRef={parentRef}
                viewportClassName="overflow-auto max-h-96 min-w-80"
                startDecorator={
                    <div className="p-2">
                        <Input
                            autoFocus
                            placeholder="Filter accounts..."
                            value={accountsFilter}
                            onFocus={() => {
                                shouldRefocus.current = true;
                            }}
                            onBlur={(e) => {
                                if (!shouldRefocus.current) return;
                                e.currentTarget.focus();
                            }}
                            onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                return setAccountsFilter(e.target.value);
                            }}
                        />
                    </div>
                }
            >
                {(filteredAccounts?.length ?? 0) <= 0 && (
                    <Typography level="body2" className="p-2" secondary>
                        No accounts found
                    </Typography>
                )}
                <div
                    className="relative w-full"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        if (!filteredAccounts) return null;
                        const account = filteredAccounts[virtualItem.index];
                        const isSuggested = suggestedIdOrder.has(account.id);
                        return (
                            <SelectItem
                                key={virtualItem.key}
                                value={account.id}
                                className="text-left absolute left-0 top-0 w-full hover:bg-muted"
                                style={{
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                <div className="flex items-center justify-between w-full gap-2">
                                    <div className="min-w-0">
                                        <AccountName
                                            account={account.name}
                                            accountCode={account.code}
                                        />
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
            </SelectContent>
        </Select>
    );
};
