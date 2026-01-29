'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { format, getMonth, getYear } from 'date-fns';
import { ArrowLeft, Calendar, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { Fragment, use, useMemo, useState } from 'react';
import { useGetAccountLedger } from '@/features/accounts/api/use-get-account-ledger';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { ACCOUNT_CLASS_LABELS, NORMAL_BALANCES } from '@/lib/accounting';
import { cn, formatCurrency } from '@/lib/utils';

// Grid layout for ledger table
const LEDGER_GRID_COLS = 'grid-cols-[140px_1fr_120px_120px_120px]';

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default function AccountLedgerPage({ params }: Props) {
    const { id } = use(params);
    const [search, setSearch] = useState('');
    const ledgerQuery = useGetAccountLedger(id);
    const settingsQuery = useGetSettings();
    const doubleEntryMode = settingsQuery.data?.doubleEntryMode ?? false;

    const isLoading = ledgerQuery.isLoading;
    const account = ledgerQuery.data?.account;
    const entries = ledgerQuery.data?.entries || [];

    // Filter entries based on search
    const filteredEntries = useMemo(() => {
        if (!search) return entries;
        const searchLower = search.toLowerCase();
        return entries.filter(
            (entry) =>
                entry.payee?.toLowerCase().includes(searchLower) ||
                entry.customerName?.toLowerCase().includes(searchLower) ||
                entry.notes?.toLowerCase().includes(searchLower),
        );
    }, [entries, search]);

    // Calculate running balance
    const entriesWithBalance = useMemo(() => {
        let runningBalance = account?.openingBalance || 0;
        // Default to debit normal balance if accountClass is not set
        const normalBalance = account?.accountClass
            ? NORMAL_BALANCES[account.accountClass]
            : 'debit';

        // Reverse the entries to calculate balance from oldest to newest
        const reversed = [...filteredEntries].reverse();

        const withBalance = reversed.map((entry) => {
            // Determine debit and credit based on transaction type
            let debitAmount = 0;
            let creditAmount = 0;

            if (entry.debitAccountId === id) {
                // This account is the debit account
                debitAmount = entry.amount;
            } else if (entry.creditAccountId === id) {
                // This account is the credit account
                creditAmount = entry.amount;
            } else if (entry.accountId === id) {
                // Legacy single-entry transaction
                // For compatibility: treat positive amounts as debits, negative as credits
                if (entry.amount >= 0) {
                    debitAmount = entry.amount;
                } else {
                    creditAmount = Math.abs(entry.amount);
                }
            }

            // Update running balance based on account's normal balance
            if (normalBalance === 'debit') {
                runningBalance = runningBalance + debitAmount - creditAmount;
            } else {
                runningBalance = runningBalance + creditAmount - debitAmount;
            }

            return {
                ...entry,
                debitAmount,
                creditAmount,
                balance: runningBalance,
            };
        });

        // Return in original order (newest first)
        return withBalance.reverse();
    }, [filteredEntries, account, id]);

    // Compute month separators - find entries where month changes and track end-of-month balances
    const monthSeparators = useMemo(() => {
        const separators: Record<
            string,
            { month: number; year: number; endBalance: number }
        > = {};

        // Entries are newest first, so we iterate and when month changes, we record the previous entry's balance
        for (let i = 0; i < entriesWithBalance.length; i++) {
            const entry = entriesWithBalance[i];
            const entryDate = new Date(entry.date);
            const month = getMonth(entryDate);
            const year = getYear(entryDate);

            // Look at next entry (older) to see if month is different
            if (i < entriesWithBalance.length - 1) {
                const nextEntry = entriesWithBalance[i + 1];
                const nextDate = new Date(nextEntry.date);
                const nextMonth = getMonth(nextDate);
                const nextYear = getYear(nextDate);

                // If month or year changes, we need a separator after this entry
                if (month !== nextMonth || year !== nextYear) {
                    // Store the separator info - the balance at the end of the older month (next entry's balance)
                    const key = `${nextYear}-${nextMonth}`;
                    separators[key] = {
                        month: nextMonth,
                        year: nextYear,
                        endBalance: nextEntry.balance,
                    };
                }
            }
        }

        return separators;
    }, [entriesWithBalance]);

    if (isLoading) {
        return (
            <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="size-8 animate-spin text-slate-300" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!account) {
        return (
            <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <Typography>Account not found</Typography>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2">
                    <div className="flex items-center gap-2">
                        <Link href="/accounts">
                            <Button variant="plain" className="h-10 w-10 p-0">
                                <ArrowLeft className="size-4" />
                            </Button>
                        </Link>
                        <Stack spacing={0}>
                            <CardTitle>{account.name}</CardTitle>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                General Ledger
                            </Typography>
                        </Stack>
                    </div>

                    {/* Account Info */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {account.code && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-800 rounded-full font-mono">
                                {account.code}
                            </span>
                        )}
                        {account.accountClass && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                {ACCOUNT_CLASS_LABELS[account.accountClass]}
                            </span>
                        )}
                        {account.accountType && (
                            <span
                                className={cn(
                                    'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
                                    account.accountType === 'debit' &&
                                        'bg-emerald-100 text-emerald-800',
                                    account.accountType === 'credit' &&
                                        'bg-red-100 text-red-800',
                                    account.accountType === 'neutral' &&
                                        'bg-gray-100 text-gray-800',
                                )}
                            >
                                {account.accountType.charAt(0).toUpperCase() +
                                    account.accountType.slice(1)}
                            </span>
                        )}
                        {account.openingBalance !== 0 && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                Opening:{' '}
                                {formatCurrency(account.openingBalance)}
                            </span>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className="flex gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {entriesWithBalance.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Calendar className="size-12 text-muted-foreground mb-4" />
                            <Typography level="h3" className="mb-2">
                                No transactions yet
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                {search
                                    ? 'No transactions match your search.'
                                    : 'Transactions for this account will appear here.'}
                            </Typography>
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            {/* Table Header */}
                            <div
                                className={cn(
                                    'grid gap-4 px-4 py-3 bg-muted/50 border-b font-medium text-sm',
                                    LEDGER_GRID_COLS,
                                )}
                            >
                                <div>Date</div>
                                <div>Customer (status)</div>
                                {doubleEntryMode && (
                                    <>
                                        <div className="text-right">Credit</div>
                                        <div className="text-right">Debit</div>
                                    </>
                                )}
                                {!doubleEntryMode && (
                                    <div className="text-right col-span-2">
                                        Amount
                                    </div>
                                )}
                                <div className="text-right">Balance</div>
                            </div>

                            {/* Transaction Rows with Month Separators */}
                            {entriesWithBalance.map((entry, index) => {
                                const entryDate = new Date(entry.date);
                                const month = getMonth(entryDate);
                                const year = getYear(entryDate);
                                const separatorKey = `${year}-${month}`;
                                const separator = monthSeparators[separatorKey];

                                // Check if we need to show a separator after this entry
                                const showSeparator =
                                    separator &&
                                    index < entriesWithBalance.length - 1;
                                const nextEntry = entriesWithBalance[index + 1];
                                const shouldShowSeparator =
                                    showSeparator &&
                                    nextEntry &&
                                    (getMonth(new Date(nextEntry.date)) !==
                                        month ||
                                        getYear(new Date(nextEntry.date)) !==
                                            year);

                                return (
                                    <Fragment key={entry.id}>
                                        <div
                                            className={cn(
                                                'grid gap-4 px-4 py-2 border-b hover:bg-muted/50 transition-colors',
                                                LEDGER_GRID_COLS,
                                            )}
                                        >
                                            <div className="text-sm">
                                                {format(
                                                    entryDate,
                                                    'dd.MM.yyyy',
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium">
                                                    {entry.customerName ||
                                                        entry.payee ||
                                                        'N/A'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {entry.status}
                                                </div>
                                            </div>
                                            {doubleEntryMode && (
                                                <>
                                                    <div className="text-right text-sm">
                                                        {entry.creditAmount > 0
                                                            ? formatCurrency(
                                                                  entry.creditAmount,
                                                              )
                                                            : '-'}
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        {entry.debitAmount > 0
                                                            ? formatCurrency(
                                                                  entry.debitAmount,
                                                              )
                                                            : '-'}
                                                    </div>
                                                </>
                                            )}
                                            {!doubleEntryMode && (
                                                <div
                                                    className={cn(
                                                        'text-right text-sm col-span-2',
                                                        entry.amount >= 0
                                                            ? 'text-emerald-600'
                                                            : 'text-red-600',
                                                    )}
                                                >
                                                    {formatCurrency(
                                                        entry.amount,
                                                    )}
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    'text-right text-sm font-medium',
                                                    entry.balance < 0 &&
                                                        'text-red-600',
                                                )}
                                            >
                                                {formatCurrency(entry.balance)}
                                            </div>
                                        </div>

                                        {/* Month/Year Separator */}
                                        {shouldShowSeparator && (
                                            <div
                                                className={cn(
                                                    'grid gap-4 px-4 py-1.5 bg-muted/30 border-b',
                                                    LEDGER_GRID_COLS,
                                                )}
                                            >
                                                <div
                                                    className="col-span-4 text-xs text-muted-foreground"
                                                    style={{
                                                        gridColumn: 'span 4',
                                                    }}
                                                >
                                                    {format(
                                                        entryDate,
                                                        'MMMM yyyy',
                                                    )}
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground">
                                                    {formatCurrency(
                                                        separator.endBalance,
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </Fragment>
                                );
                            })}

                            {/* Opening Balance Row - displayed at the bottom (before first transaction chronologically) */}
                            {account.openingBalance !== 0 && (
                                <div
                                    className={cn(
                                        'grid gap-4 px-4 py-3 bg-purple-50/50',
                                        LEDGER_GRID_COLS,
                                    )}
                                >
                                    <div className="text-sm text-muted-foreground">
                                        Opening
                                    </div>
                                    <div className="text-sm font-medium">
                                        Opening Balance
                                    </div>
                                    {doubleEntryMode && (
                                        <>
                                            <div className="text-right text-sm">
                                                -
                                            </div>
                                            <div className="text-right text-sm">
                                                -
                                            </div>
                                        </>
                                    )}
                                    {!doubleEntryMode && (
                                        <div className="text-right text-sm col-span-2">
                                            -
                                        </div>
                                    )}
                                    <div className="text-right text-sm font-medium">
                                        {formatCurrency(account.openingBalance)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
