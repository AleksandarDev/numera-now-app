"use client";

import { Loader2, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { transactions as transactionSchema } from "@/db/schema";
import { useSelectAccount } from "@/features/accounts/hooks/use-select-account";
import { useBulkCreateTransactions } from "@/features/transactions/api/use-bulk-create-transactions";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";

import { TransactionsDataTable } from "./TransactionsDataTable";
import { ImportButton } from "@/components/import-button";
import { ImportCard } from "@/components/import/import-card";

enum VARIANTS {
  LIST = "LIST",
  IMPORT = "IMPORT",
}

const INITIAL_IMPORT_RESULTS = {
  data: [],
  errors: [],
  meta: [],
};

function TransactionsImportView({ importResults, onDone }: { importResults: typeof INITIAL_IMPORT_RESULTS, onDone: () => void }) {
  const [AccountDialog, confirm] = useSelectAccount();
  const createTransactions = useBulkCreateTransactions();

  const onSubmitImport = async (
    values: (typeof transactionSchema.$inferInsert)[]
  ) => {
    const accountId = await confirm();

    if (!accountId) {
      return toast.error("Please select an account to continue.");
    }

    const data = values.map((value) => ({
      ...value,
      accountId,
    }));

    createTransactions.mutate(data, {
      onSuccess: () => {
        onDone();
      },
    });
  };

  return (
    <>
      <AccountDialog />

      <ImportCard
        header="Import transactions"
        requiredOptions={["date", "description", "amount"]}
        data={importResults.data}
        onCancel={onDone}
        onSubmit={onSubmitImport} />
    </>
  );
}

export default function TransactionsPage() {
  const [importResults, setImportResults] = useState(INITIAL_IMPORT_RESULTS);
  const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);

  const newTransaction = useNewTransaction();

  const onUpload = (results: typeof INITIAL_IMPORT_RESULTS) => {
    setImportResults(results);
    setVariant(VARIANTS.IMPORT);
  };

  if (variant === VARIANTS.IMPORT) {
    <Suspense>
      <TransactionsImportView
        importResults={importResults}
        onDone={() => {
          setImportResults(INITIAL_IMPORT_RESULTS);
          setVariant(VARIANTS.LIST);
        }} />
    </Suspense>
  }

  return (
    <div className="mx-auto -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
      <Card>
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>
            Transaction History
          </CardTitle>
          <div className="flex flex-col items-center gap-x-2 gap-y-2 md:flex-row">
            <Button
              size="sm"
              onClick={() => newTransaction.onOpen(false)}
              className="w-full lg:w-auto"
            >
              <Plus className="mr-2 size-4" /> Add new
            </Button>
            <Button
              size="sm"
              onClick={() => newTransaction.onOpen(true)}
              className="w-full lg:w-auto"
            >
              <Plus className="mr-2 size-4" /> Add new double entry
            </Button>
            <ImportButton onUpload={onUpload} />
          </div>
        </CardHeader>

        <CardContent>
          <Suspense fallback={(
            <div className="flex h-[500px] w-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-slate-300" />
            </div>
          )}>
            <TransactionsDataTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
