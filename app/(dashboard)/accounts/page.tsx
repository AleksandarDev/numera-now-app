"use client";

import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useNewAccount } from "@/features/accounts/hooks/use-new-accounts";
import { Suspense, useRef, useState } from "react";
import { accounts as accountsSchema } from "@/db/schema";
import { ImportCard } from "./import-card";
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
    const accountsQuery = useGetAccounts({ search, pageSize: 9999 });
    const accounts = accountsQuery.data || [];

    const isDisabled = accountsQuery.isLoading;

    // The scrollable element for your list
    const parentRef = useRef(null)

    // The virtualizer
    const rowVirtualizer = useVirtualizer({
        count: accounts.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
    });

    return (
        <Stack spacing={2}>
            <Input
                placeholder={`Filter accounts...`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="max-w-sm" />

            <div
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
                        const account = accounts[virtualItem.index];
                        const { name, code } = account;
                        const depth = (account.code?.length ?? 1) - 1;
                        const hasChildren = code
                            ? accounts.some((a) => a.code && a.code.startsWith(code) && a.code.length === code.length + 1)
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
                                        paddingLeft: depth * 24,
                                    }}>
                                    <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 gap-1">
                                        <Stack>
                                            <Typography
                                                title={name}
                                                level="body1"
                                                className="line-clamp-1"
                                                style={{
                                                    fontWeight: hasChildren ? 'bold' : 'normal',
                                                }}>
                                                {name}
                                            </Typography>
                                            <Typography level="body2" mono>
                                                {code}
                                            </Typography>
                                        </Stack>
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
