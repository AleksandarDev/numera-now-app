"use client";

import { Import, Loader2, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { useBulkDeleteAccounts } from "@/features/accounts/api/use-bulk-delete-accounts";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useNewAccount } from "@/features/accounts/hooks/use-new-accounts";
import { columns } from "./columns";
import { Suspense, useState } from "react";
import { ImportButton } from "./import-button";
import { accounts as accountsSchema } from "@/db/schema";
import { ImportCard } from "./import-card";
import { useBulkCreateAccounts } from "@/features/accounts/api/use-bulk-create-accounts";

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
    const deleteAccounts = useBulkDeleteAccounts();
    const accountsQuery = useGetAccounts();
    const accounts = accountsQuery.data || [];

    const isDisabled = accountsQuery.isLoading || deleteAccounts.isPending;

    return (
        <DataTable
            filterKey="name"
            columns={columns}
            data={accounts}
            onDelete={(row) => {
                const ids = row.map((r) => r.original.id);

                deleteAccounts.mutate({ ids });
            }}
            disabled={isDisabled}
        />
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
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>Accounts Page</CardTitle>
                    <div className="flex flex-col items-center gap-x-2 gap-y-2 lg:flex-row">
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
