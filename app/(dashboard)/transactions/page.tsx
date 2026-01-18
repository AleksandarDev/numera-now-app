'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Archive, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AccountFilter } from '@/components/account-filter';
import { DataTableSearch } from '@/components/data-table-search';
import { DateFilter } from '@/components/date-filter';
import { ImportCard } from '@/components/import/import-card';
import { ImportButton } from '@/components/import-button';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSelectImportAccounts } from '@/features/accounts/hooks/use-select-import-accounts';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { lookupCustomerByIban } from '@/features/customers/api/use-lookup-customer-by-iban';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import { useBulkCreateTransactions } from '@/features/transactions/api/use-bulk-create-transactions';
import { useNewTransaction } from '@/features/transactions/hooks/use-new-transaction';
import { convertAmountToMiliunits } from '@/lib/utils';
import { TransactionsDataTable } from './TransactionsDataTable';

enum VARIANTS {
    LIST = 'LIST',
    IMPORT = 'IMPORT',
}

const INITIAL_IMPORT_RESULTS = {
    data: [] as string[][],
    errors: [] as unknown[],
    meta: [] as unknown[],
};

function TransactionsImportView({
    importResults,
    onDone,
}: {
    importResults: typeof INITIAL_IMPORT_RESULTS;
    onDone: () => void;
}) {
    const [AccountDialog, confirm] = useSelectImportAccounts();
    const [isImporting, setIsImporting] = useState(false);
    const createTransactions = useBulkCreateTransactions();
    const { data: customers } = useGetCustomers();
    const { data: settings } = useGetSettings();

    const onSubmitImport = async (
        values: {
            date?: string;
            payee?: string;
            payeeIban?: string;
            amount?: string;
            inflow?: string;
            outflow?: string;
            notes?: string;
        }[],
    ) => {
        const accountSelection = await confirm();

        if (!accountSelection) {
            return toast.error(
                'Please select at least one account to continue.',
            );
        }

        const { inflowAccountId, outflowAccountId } = accountSelection;
        const doubleEntryMode = settings?.doubleEntryMode ?? false;

        // Create a map of customer names (lowercase) to customer IDs for case-insensitive matching
        const customerMap = new Map<string, string>();
        if (customers) {
            customers.forEach((customer) => {
                customerMap.set(customer.name.toLowerCase(), customer.id);
            });
        }

        // Helper to parse amount strings with various formats (1.234,56 or 1,234.56)
        const parseAmount = (value: string | undefined): number => {
            if (!value || value.trim() === '' || value === '0') return 0;
            // Remove spaces and handle European format (1.234,56 -> 1234.56)
            let cleaned = value.trim();
            // Check if it's European format (comma as decimal separator)
            if (
                cleaned.includes(',') &&
                cleaned.indexOf(',') > cleaned.lastIndexOf('.')
            ) {
                // European format: 1.234,56 -> remove dots, replace comma with dot
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else if (cleaned.includes(',') && !cleaned.includes('.')) {
                // Only comma, likely European decimal: 123,45 -> 123.45
                cleaned = cleaned.replace(',', '.');
            } else {
                // US format or no decimal: remove commas
                cleaned = cleaned.replace(/,/g, '');
            }
            return parseFloat(cleaned) || 0;
        };

        // Helper to parse date strings with various formats
        const parseDate = (value: string | undefined): Date => {
            if (!value) return new Date();
            const trimmed = value.trim();
            // Try DD.MM.YYYY format (European)
            const euroMatch = trimmed.match(
                /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/,
            );
            if (euroMatch) {
                const [, day, month, year] = euroMatch;
                return new Date(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                );
            }
            // Try YYYY-MM-DD format
            const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (isoMatch) {
                const [, year, month, day] = isoMatch;
                return new Date(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                );
            }
            // Try MM/DD/YYYY format
            const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (usMatch) {
                const [, month, day, year] = usMatch;
                return new Date(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                );
            }
            // Fallback to Date constructor
            const parsed = new Date(trimmed);
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        };

        // Collect unique IBANs from import data for batch lookup
        const uniqueIbans = new Set<string>();
        values.forEach((value) => {
            if (value.payeeIban?.trim()) {
                uniqueIbans.add(
                    value.payeeIban.trim().toUpperCase().replace(/\s/g, ''),
                );
            }
        });

        // Lookup all IBANs in parallel and create a map
        const ibanToCustomerMap = new Map<string, string>();
        if (uniqueIbans.size > 0) {
            const ibanLookups = await Promise.all(
                Array.from(uniqueIbans).map(async (iban) => {
                    const result = await lookupCustomerByIban(iban);
                    return { iban, customerId: result?.customerId };
                }),
            );
            ibanLookups.forEach(({ iban, customerId }) => {
                if (customerId) {
                    ibanToCustomerMap.set(iban, customerId);
                }
            });
        }

        const data = values.map((value) => {
            const payeeValue = value.payee?.trim();
            const payeeIbanValue = value.payeeIban
                ?.trim()
                .toUpperCase()
                .replace(/\s/g, '');

            // Try to match customer: first by IBAN, then by name (case-insensitive)
            let customerId: string | undefined;
            if (payeeIbanValue) {
                customerId = ibanToCustomerMap.get(payeeIbanValue);
            }
            if (!customerId && payeeValue) {
                customerId = customerMap.get(payeeValue.toLowerCase());
            }

            // Calculate amount: if separate inflow/outflow columns exist, use them
            // Amounts are stored as positive values, account determines direction
            let amount = 0;
            let isInflow = false;

            if (value.inflow || value.outflow) {
                const inflow = parseAmount(value.inflow);
                const outflow = parseAmount(value.outflow);

                if (inflow > 0) {
                    amount = inflow;
                    isInflow = true;
                } else if (outflow > 0) {
                    amount = outflow;
                    isInflow = false;
                }
            } else {
                const parsedAmount = parseAmount(value.amount);
                amount = Math.abs(parsedAmount);
                isInflow = parsedAmount >= 0;
            }

            // In double-entry mode, create proper credit/debit transactions
            // Otherwise use single accountId with draft status
            if (doubleEntryMode) {
                // For inflow (income/deposit): money goes INTO debit account (e.g., bank account)
                // For outflow (expense/withdrawal): money comes FROM credit account (e.g., bank account)
                // Only set one account per transaction - the other stays empty
                const creditAccountId = isInflow
                    ? null
                    : outflowAccountId || inflowAccountId;

                const debitAccountId = isInflow
                    ? inflowAccountId || outflowAccountId
                    : null;

                if (!creditAccountId && !debitAccountId) {
                    throw new Error(
                        'Double-entry mode requires at least one account',
                    );
                }

                // Only set status to pending if both accounts are present, otherwise draft
                const hasBothAccounts = creditAccountId && debitAccountId;

                return {
                    date: parseDate(value.date),
                    amount: convertAmountToMiliunits(amount),
                    notes: value.notes?.trim() || null,
                    payeeCustomerId: customerId || null,
                    payee: customerId ? null : payeeValue || null,
                    creditAccountId,
                    debitAccountId,
                    status: hasBothAccounts
                        ? ('pending' as const)
                        : ('draft' as const),
                };
            } else {
                // Single-entry mode: use accountId and draft status
                const accountId = isInflow
                    ? inflowAccountId || outflowAccountId
                    : outflowAccountId || inflowAccountId;

                if (!accountId) {
                    throw new Error('No account selected for transaction');
                }

                return {
                    date: parseDate(value.date),
                    amount: convertAmountToMiliunits(amount),
                    notes: value.notes?.trim() || null,
                    payeeCustomerId: customerId || null,
                    payee: customerId ? null : payeeValue || null,
                    accountId,
                    status: 'draft' as const,
                };
            }
        });

        setIsImporting(true);
        createTransactions.mutate(data, {
            onSuccess: () => {
                setIsImporting(false);
                onDone();
            },
            onError: (error) => {
                setIsImporting(false);
                console.error('Error creating transactions:', error);
                toast.error(error.message || 'Failed to create transactions.');
            },
        });
    };

    return (
        <>
            <AccountDialog />

            <ImportCard
                header="Import transactions"
                requiredOptions={['date']}
                options={[
                    'date',
                    'payee',
                    'payeeIban',
                    'amount',
                    'inflow',
                    'outflow',
                    'notes',
                ]}
                data={importResults.data}
                onCancel={onDone}
                onSubmit={onSubmitImport}
                isImporting={isImporting}
            />
        </>
    );
}

export default function TransactionsPage() {
    const [importResults, setImportResults] = useState(INITIAL_IMPORT_RESULTS);
    const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const newTransaction = useNewTransaction();

    const onUpload = (results: typeof INITIAL_IMPORT_RESULTS) => {
        if (!results || !results.data || results.data.length === 0) {
            toast.error(
                'No data found in the CSV file. Please check the file format.',
            );
            return;
        }

        setImportResults(results);
        setVariant(VARIANTS.IMPORT);
    };

    if (variant === VARIANTS.IMPORT) {
        return (
            <Suspense>
                <TransactionsImportView
                    importResults={importResults}
                    onDone={() => {
                        setImportResults(INITIAL_IMPORT_RESULTS);
                        setVariant(VARIANTS.LIST);
                    }}
                />
            </Suspense>
        );
    }

    return (
        <div className="mx-auto -mt-12 md:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2 flex-row items-center justify-between">
                    <CardTitle>Transactions</CardTitle>
                    <div className="flex flex-row items-center gap-x-2 gap-y-2">
                        <Button
                            size="sm"
                            onClick={() => newTransaction.onOpen()}
                            className="w-full lg:w-auto"
                        >
                            <Plus className="size-4" />
                            <span className="hidden sm:inline sm:ml-2">
                                Add new
                            </span>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full lg:w-auto"
                                >
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() =>
                                        newTransaction.onOpen(
                                            undefined,
                                            'import',
                                        )
                                    }
                                >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Import from ZIP
                                </DropdownMenuItem>
                                <ImportButton
                                    onUpload={onUpload}
                                    variant="menu"
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() =>
                                        setBulkDeleteMode(!bulkDeleteMode)
                                    }
                                >
                                    {bulkDeleteMode
                                        ? 'Cancel bulk delete'
                                        : 'Bulk delete'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="flex flex-col items-stretch gap-y-2 md:flex-row md:gap-x-2 md:gap-y-0">
                        <DataTableSearch
                            filterKey="payeeCustomerName"
                            placeholder="Filter transactions..."
                            columnFilters={columnFilters}
                            onColumnFiltersChange={setColumnFilters}
                            className="w-full md:w-[220px]"
                        />
                        <AccountFilter />
                        <DateFilter />
                    </div>
                    <Suspense
                        fallback={
                            <div className="flex h-[500px] w-full items-center justify-center">
                                <Loader2 className="size-6 animate-spin text-slate-300" />
                            </div>
                        }
                    >
                        <TransactionsDataTable
                            bulkDeleteMode={bulkDeleteMode}
                            columnFilters={columnFilters}
                            onColumnFiltersChange={setColumnFilters}
                        />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
