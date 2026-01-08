'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    ChevronDown,
    ChevronRight,
    Expand,
    Loader2,
    Minimize2,
    MoreHorizontal,
    Plus,
} from 'lucide-react';
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import { type CSVResult, ImportButton } from '@/components/import-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { accounts as accountsSchema } from '@/db/schema';
import { useBulkCreateAccounts } from '@/features/accounts/api/use-bulk-create-accounts';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';
import { useNewAccount } from '@/features/accounts/hooks/use-new-accounts';
import { ImportCard } from '../../../components/import/import-card';
import { Actions } from './actions';

enum VARIANTS {
    LIST = 'LIST',
    IMPORT = 'IMPORT',
}

const INITIAL_IMPORT_RESULTS = {
    data: [] as string[][],
    errors: [] as unknown[],
    meta: [] as unknown[],
};

function AccountsDataTable() {
    const [search, setSearch] = useState('');
    const [showClosed, setShowClosed] = useState(false);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
        new Set(),
    );
    const accountsQuery = useGetAccounts({
        search,
        pageSize: 9999,
        showClosed,
    });
    const allAccounts = accountsQuery.data || [];
    const newAccount = useNewAccount();

    const isDisabled = accountsQuery.isLoading;

    // Helper function to get account's children
    const getAccountChildren = (parentCode: string) => {
        return allAccounts.filter(
            (account) =>
                account.code?.startsWith(parentCode) &&
                account.code.length === parentCode.length + 1,
        );
    };

    // Helper function to check if account has children
    const hasChildren = (account: { code?: string | null }) => {
        const code = account.code;
        return code ? getAccountChildren(code).length > 0 : false;
    };

    // Helper function to check if account should be visible
    const isAccountVisible = useCallback(
        (account: { code?: string | null }) => {
            const code = account.code;
            if (!code || code.length <= 1) return true; // Root level accounts are always visible

            // Check if all parent accounts are expanded
            for (let i = 1; i < code.length; i++) {
                const parentCode = code.substring(0, i);
                if (!expandedAccounts.has(parentCode)) {
                    return false;
                }
            }
            return true;
        },
        [expandedAccounts],
    );

    // Filter and sort accounts, then apply visibility rules
    const visibleAccounts = useMemo(() => {
        return allAccounts.filter(isAccountVisible).sort((a, b) => {
            const codeA = a.code || '';
            const codeB = b.code || '';
            return codeA.localeCompare(codeB);
        });
    }, [allAccounts, isAccountVisible]);

    // Toggle expand/collapse for an account
    const toggleExpand = (code: string) => {
        setExpandedAccounts((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };

    // The scrollable element for your list
    const parentRef = useRef(null);

    // The virtualizer
    const rowVirtualizer = useVirtualizer({
        count: visibleAccounts.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
    });

    return (
        <Stack spacing={2}>
            {accountsQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading accounts...
                </div>
            )}
            {allAccounts.length === 0 && !accountsQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <p className="text-lg font-medium text-gray-900 mb-2">
                        No accounts yet
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Get started by creating your first account or importing
                        existing accounts.
                    </p>
                    <div className="flex gap-3">
                        <Button onClick={newAccount.onOpen}>
                            <Plus className="mr-2 size-4" />
                            Create Account
                        </Button>
                        <ImportButton
                            onUpload={(
                                results: typeof INITIAL_IMPORT_RESULTS,
                            ) => {
                                // Handle import inline
                                window.dispatchEvent(
                                    new CustomEvent('accounts-import', {
                                        detail: results,
                                    }),
                                );
                            }}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row justify-between gap-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                placeholder={`Filter accounts...`}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="max-w-sm"
                            />

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    checked={showClosed}
                                    onCheckedChange={(checked) =>
                                        setShowClosed(checked === true)
                                    }
                                    id="show-closed"
                                />
                                <label
                                    htmlFor="show-closed"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Show closed accounts
                                </label>
                            </div>
                        </div>

                        <div className="flex">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    // Expand all accounts that have children
                                    const accountsWithChildren = allAccounts
                                        .filter((account) =>
                                            hasChildren(account),
                                        )
                                        .map((account) => account.code)
                                        .filter((code): code is string =>
                                            Boolean(code),
                                        );
                                    setExpandedAccounts(
                                        new Set(accountsWithChildren),
                                    );
                                }}
                                disabled={isDisabled}
                            >
                                <Expand className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpandedAccounts(new Set())}
                                disabled={isDisabled}
                            >
                                <Minimize2 className="size-4" />
                            </Button>
                        </div>
                    </div>{' '}
                    <div
                        ref={parentRef}
                        className="overflow-auto max-h-[680px] border rounded-md"
                    >
                        <div
                            className="relative w-full"
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                            }}
                        >
                            {rowVirtualizer
                                .getVirtualItems()
                                .map((virtualItem) => {
                                    const account =
                                        visibleAccounts[virtualItem.index];
                                    const { name, code } = account;
                                    const depth =
                                        (account.code?.length ?? 1) - 1;
                                    const accountHasChildren =
                                        hasChildren(account);
                                    const isExpanded = code
                                        ? expandedAccounts.has(code)
                                        : false;

                                    return (
                                        <div
                                            key={virtualItem.key}
                                            className="absolute top-0 left-0 w-full"
                                            style={{
                                                height: `${virtualItem.size}px`,
                                                transform: `translateY(${virtualItem.start}px)`,
                                            }}
                                        >
                                            <div
                                                className="border-b group hover:bg-neutral-100"
                                                style={{
                                                    paddingLeft:
                                                        depth * 24 +
                                                        (accountHasChildren
                                                            ? 0
                                                            : 24), // Add indent for leaf nodes
                                                }}
                                            >
                                                <div className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2 gap-1">
                                                    {/* Expand/Collapse Button */}
                                                    <div className="w-6 flex justify-center">
                                                        {accountHasChildren &&
                                                            code && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 hover:bg-neutral-200"
                                                                    onClick={() =>
                                                                        toggleExpand(
                                                                            code,
                                                                        )
                                                                    }
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                    </div>

                                                    {/* Account Info */}
                                                    <Stack>
                                                        <div className="flex items-center gap-2">
                                                            <Typography
                                                                title={name}
                                                                level="body1"
                                                                className="line-clamp-1"
                                                                style={{
                                                                    fontWeight:
                                                                        accountHasChildren
                                                                            ? 'bold'
                                                                            : 'normal',
                                                                }}
                                                            >
                                                                {name}
                                                            </Typography>
                                                            {!account.isOpen && (
                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-800 text-red-100 rounded-full">
                                                                    Closed
                                                                </span>
                                                            )}
                                                            {account.isReadOnly && (
                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-800 rounded-full">
                                                                    Read-only
                                                                </span>
                                                            )}
                                                            {account.accountType ===
                                                                'credit' && (
                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                                                    Credit
                                                                </span>
                                                            )}
                                                            {account.accountType ===
                                                                'debit' && (
                                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
                                                                    Debit
                                                                </span>
                                                            )}
                                                            {account.hasInvalidConfig && (
                                                                <span
                                                                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full"
                                                                    title="Account is open but one or more parent accounts are closed"
                                                                >
                                                                    ⚠️ Invalid
                                                                    Config
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Typography
                                                            level="body2"
                                                            mono
                                                        >
                                                            {code}
                                                        </Typography>
                                                    </Stack>

                                                    {/* Actions */}
                                                    <Actions
                                                        id={account.id}
                                                        disabled={isDisabled}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                    {/* <DataTable
                columns={columns}
                data={accounts}
                onDelete={(row) => {
                    const ids = row.map((r) => r.original.id);

                    deleteAccounts.mutate({ ids });
                }}
                loading={accountsQuery.isLoading}
                disabled={isDisabled}
            /> */}
                </>
            )}
        </Stack>
    );
}

export default function AccountsPage() {
    const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);
    const [importResults, setImportResults] = useState<CSVResult>(
        INITIAL_IMPORT_RESULTS,
    );
    const newAccount = useNewAccount();
    const createAccounts = useBulkCreateAccounts();

    const onImport = useCallback((results: CSVResult) => {
        if (!results || !results.data || results.data.length === 0) {
            toast.error(
                'No data found in the CSV file. Please check the file format.',
            );
            return;
        }

        setImportResults(results);
        setVariant(VARIANTS.IMPORT);
    }, []);

    // Listen for import events from empty state
    useEffect(() => {
        const handleImport = (event: CustomEvent<CSVResult>) => {
            onImport(event.detail);
        };
        window.addEventListener(
            'accounts-import',
            handleImport as EventListener,
        );
        return () =>
            window.removeEventListener(
                'accounts-import',
                handleImport as EventListener,
            );
    }, [onImport]);

    const onCancelImport = () => {
        setImportResults(INITIAL_IMPORT_RESULTS);
        setVariant(VARIANTS.LIST);
    };

    const onSubmitImport = async (values: Record<string, string | null>[]) => {
        // Transform the imported records to match the accounts schema
        const accountsData =
            values as unknown as (typeof accountsSchema.$inferInsert)[];
        createAccounts.mutate(accountsData, {
            onSuccess: () => {
                onCancelImport();
            },
        });
    };

    if (variant === VARIANTS.IMPORT) {
        return (
            <ImportCard
                header="Accounts Import"
                requiredOptions={['name', 'code']}
                options={['name', 'code']}
                data={importResults.data}
                onCancel={onCancelImport}
                onSubmit={onSubmitImport}
            />
        );
    }

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Accounts</CardTitle>
                    <div className="flex flex-col items-center gap-x-2 gap-y-2 md:flex-row">
                        <Button
                            size="sm"
                            onClick={newAccount.onOpen}
                            className="w-full lg:w-auto"
                        >
                            <Plus className="mr-2 size-4" /> Add new
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
                                <ImportButton
                                    onUpload={onImport}
                                    variant="menu"
                                />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <Suspense
                        fallback={
                            <div className="flex h-[500px] w-full items-center justify-center">
                                <Loader2 className="size-6 animate-spin text-slate-300" />
                            </div>
                        }
                    >
                        <AccountsDataTable />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
