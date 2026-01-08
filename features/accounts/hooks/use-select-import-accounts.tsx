import { type ReactNode, useRef, useState } from 'react';

import { Select } from '@/components/select';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCreateAccount } from '@/features/accounts/api/use-create-account';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';

export type ImportAccountSelection = {
    inflowAccountId?: string;
    outflowAccountId?: string;
};

export const useSelectImportAccounts = (): [
    () => ReactNode,
    () => Promise<ImportAccountSelection | undefined>,
] => {
    const accountQuery = useGetAccounts();
    const accountMutation = useCreateAccount();

    const onCreateAccount = (name: string) =>
        accountMutation.mutate({
            name,
        });

    const accountOptions = (accountQuery.data ?? []).map((account) => ({
        label: account.name,
        value: account.id,
    }));

    const [promise, setPromise] = useState<{
        resolve: (value: ImportAccountSelection | undefined) => void;
    } | null>(null);

    const inflowAccountValue = useRef<string | undefined>(undefined);
    const outflowAccountValue = useRef<string | undefined>(undefined);

    const confirm = (): Promise<ImportAccountSelection | undefined> =>
        new Promise((resolve) => {
            setPromise({ resolve });
        });

    const handleClose = () => setPromise(null);

    const handleConfirm = () => {
        // At least one account must be selected
        if (!inflowAccountValue.current && !outflowAccountValue.current) {
            return;
        }
        promise?.resolve({
            inflowAccountId: inflowAccountValue.current,
            outflowAccountId: outflowAccountValue.current,
        });
        handleClose();
    };

    const handleCancel = () => {
        promise?.resolve(undefined);
        handleClose();
    };

    const AccountSelectionDialog = () => (
        <Dialog open={promise !== null} onOpenChange={handleCancel}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Import Accounts</DialogTitle>
                    <DialogDescription>
                        Select accounts for inflow (income) and outflow
                        (expenses) transactions. At least one account must be
                        selected.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="inflow-account">
                            Inflow Account (for income/deposits)
                        </Label>
                        <Select
                            placeholder="Select inflow account (optional)"
                            options={accountOptions}
                            onCreate={onCreateAccount}
                            onChange={(value) => {
                                inflowAccountValue.current = value;
                            }}
                            disabled={
                                accountQuery.isLoading ||
                                accountMutation.isPending
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="outflow-account">
                            Outflow Account (for expenses/withdrawals)
                        </Label>
                        <Select
                            placeholder="Select outflow account (optional)"
                            options={accountOptions}
                            onCreate={onCreateAccount}
                            onChange={(value) => {
                                outflowAccountValue.current = value;
                            }}
                            disabled={
                                accountQuery.isLoading ||
                                accountMutation.isPending
                            }
                        />
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button onClick={handleCancel} variant="outline">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return [AccountSelectionDialog, confirm];
};
