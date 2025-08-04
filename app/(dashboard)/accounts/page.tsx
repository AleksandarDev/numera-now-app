"use client";

import { Loader2, Plus, ChevronDown, ChevronRight, Expand, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useNewAccount } from "@/features/accounts/hooks/use-new-accounts";
import { Suspense, useRef, useState, useMemo } from "react";
import { accounts as accountsSchema } from "@/db/schema";
import { ImportCard } from "../../../components/import/import-card";
import { useBulkCreateAccounts } from "@/features/accounts/api/use-bulk-create-accounts";
import { ImportButton } from "@/components/import-button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from '@tanstack/react-virtual';
import { Typography } from "@signalco/ui-primitives/Typography";
import { Actions } from "./actions";

enum VARIANTS {
    LIST = "LIST",
    IMPORT = "IMPORT",
}

const INITIAL_IMPORT_RESULTS = {
    data: [],
    errors: [],
    meta: [],
};

function AccountsDataTable() {
    const [search, setSearch] = useState("");
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
    const accountsQuery = useGetAccounts({ search, pageSize: 9999 });
    const allAccounts = accountsQuery.data || [];

    const isDisabled = accountsQuery.isLoading;

    // Helper function to get account's children
    const getAccountChildren = (parentCode: string) => {
        return allAccounts.filter(account =>
            account.code &&
            account.code.startsWith(parentCode) &&
            account.code.length === parentCode.length + 1
        );
    };

    // Helper function to check if account has children
    const hasChildren = (account: { code?: string | null }) => {
        const code = account.code;
        return code ? getAccountChildren(code).length > 0 : false;
    };

    // Helper function to check if account should be visible
    const isAccountVisible = (account: { code?: string | null }) => {
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
    };

    // Filter and sort accounts, then apply visibility rules
    const visibleAccounts = useMemo(() => {
        return allAccounts
            .filter(isAccountVisible)
            .sort((a, b) => {
                const codeA = a.code || '';
                const codeB = b.code || '';
                return codeA.localeCompare(codeB);
            });
    }, [allAccounts, expandedAccounts]);

    // Toggle expand/collapse for an account
    const toggleExpand = (code: string) => {
        setExpandedAccounts(prev => {
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
    const parentRef = useRef(null)

    // The virtualizer
    const rowVirtualizer = useVirtualizer({
        count: visibleAccounts.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
    });

    return (
        <Stack spacing={2}>
            <div className="flex flex-col sm:flex-row justify-between gap-2">
                <Input
                    placeholder={`Filter accounts...`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="max-w-sm" />

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            // Expand all accounts that have children
                            const accountsWithChildren = allAccounts
                                .filter(account => hasChildren(account))
                                .map(account => account.code)
                                .filter(Boolean) as string[];
                            setExpandedAccounts(new Set(accountsWithChildren));
                        }}
                        disabled={isDisabled}
                    >
                        <Expand className="h-4 w-4 mr-1" />
                        Expand All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedAccounts(new Set())}
                        disabled={isDisabled}
                    >
                        <Minimize2 className="h-4 w-4 mr-1" />
                        Collapse All
                    </Button>
                </div>
            </div>            <div
                ref={parentRef}
                className="overflow-auto max-h-[680px] border rounded-md"
            >
                <div
                    className="relative w-full"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        const account = visibleAccounts[virtualItem.index];
                        const { name, code } = account;
                        const depth = (account.code?.length ?? 1) - 1;
                        const accountHasChildren = hasChildren(account);
                        const isExpanded = code ? expandedAccounts.has(code) : false;

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
                                        paddingLeft: depth * 24 + (accountHasChildren ? 0 : 24), // Add indent for leaf nodes
                                    }}>
                                    <div className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2 gap-1">
                                        {/* Expand/Collapse Button */}
                                        <div className="w-6 flex justify-center">
                                            {accountHasChildren && code && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:bg-neutral-200"
                                                    onClick={() => toggleExpand(code)}
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
                                            <Typography
                                                title={name}
                                                level="body1"
                                                className="line-clamp-1"
                                                style={{
                                                    fontWeight: accountHasChildren ? 'bold' : 'normal',
                                                }}>
                                                {name}
                                            </Typography>
                                            <Typography level="body2" mono>
                                                {code}
                                            </Typography>
                                        </Stack>

                                        {/* Actions */}
                                        <Actions id={account.id} disabled={isDisabled} />
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
        </Stack>
    );
}

export default function AccountsPage() {
    const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);
    const [importResults, setImportResults] = useState(INITIAL_IMPORT_RESULTS);
    const newAccount = useNewAccount();
    const createAccounts = useBulkCreateAccounts();

    const onImport = (results: typeof INITIAL_IMPORT_RESULTS) => {
        setImportResults(results);
        setVariant(VARIANTS.IMPORT);
    };

    const onCancelImport = () => {
        setImportResults(INITIAL_IMPORT_RESULTS);
        setVariant(VARIANTS.LIST);
    };

    const onSubmitImport = async (
        values: (typeof accountsSchema.$inferInsert)[]
    ) => {
        createAccounts.mutate(values, {
            onSuccess: () => {
                onCancelImport();
            },
        });
    };

    if (variant === VARIANTS.IMPORT) {
        return (
            <>
                <ImportCard
                    header="Accounts Import"
                    requiredOptions={["name", "code"]}
                    data={importResults.data}
                    onCancel={onCancelImport}
                    onSubmit={onSubmitImport} />
            </>
        );
    }

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Accounts Page</CardTitle>
                    <div className="flex flex-col items-center gap-x-2 gap-y-2 md:flex-row">
                        <Button size="sm" onClick={newAccount.onOpen} className="w-full lg:w-auto">
                            <Plus className="mr-2 size-4" /> Add new
                        </Button>
                        <ImportButton onUpload={onImport} />
                    </div>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={(
                        <div className="flex h-[500px] w-full items-center justify-center">
                            <Loader2 className="size-6 animate-spin text-slate-300" />
                        </div>
                    )}>
                        <AccountsDataTable />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    );
}
