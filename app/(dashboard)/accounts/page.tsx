"use client";

import { Loader2, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/card";
import { useBulkDeleteAccounts } from "@/features/accounts/api/use-bulk-delete-accounts";
import { useGetAccounts } from "@/features/accounts/api/use-get-accounts";
import { useNewAccount } from "@/features/accounts/hooks/use-new-accounts";
import { columns } from "./columns";
import { Suspense } from "react";

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
    const newAccount = useNewAccount();

    return (
        <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>Accounts Page</CardTitle>
                    <Button size="sm" onClick={newAccount.onOpen}>
                        <Plus className="mr-2 size-4" /> Add new
                    </Button>
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
