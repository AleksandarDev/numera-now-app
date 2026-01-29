import { Button } from '@signalco/ui-primitives/Button';
import { type ReactNode, useState } from 'react';
import { AccountSelect } from '@/components/account-select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export type ImportAccountSelection = {
    inflowAccountId?: string;
    outflowAccountId?: string;
};

export const useSelectImportAccounts = (): [
    () => ReactNode,
    () => Promise<ImportAccountSelection | undefined>,
] => {
    const [promise, setPromise] = useState<{
        resolve: (value: ImportAccountSelection | undefined) => void;
    } | null>(null);

    const [inflowAccountValue, setInflowAccountValue] = useState<string>('');
    const [outflowAccountValue, setOutflowAccountValue] = useState<string>('');

    const confirm = (): Promise<ImportAccountSelection | undefined> =>
        new Promise((resolve) => {
            // Reset values when opening dialog
            setInflowAccountValue('');
            setOutflowAccountValue('');
            setPromise({ resolve });
        });

    const handleClose = () => setPromise(null);

    const handleConfirm = () => {
        // At least one account must be selected
        if (!inflowAccountValue && !outflowAccountValue) {
            return;
        }
        promise?.resolve({
            inflowAccountId: inflowAccountValue || undefined,
            outflowAccountId: outflowAccountValue || undefined,
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
                        <AccountSelect
                            placeholder="Select inflow account (optional)"
                            value={inflowAccountValue}
                            onChange={setInflowAccountValue}
                            showClosed={false}
                            excludeReadOnly={true}
                            allowedTypes={['credit', 'debit', 'neutral']}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="outflow-account">
                            Outflow Account (for expenses/withdrawals)
                        </Label>
                        <AccountSelect
                            placeholder="Select outflow account (optional)"
                            value={outflowAccountValue}
                            onChange={setOutflowAccountValue}
                            showClosed={false}
                            excludeReadOnly={true}
                            allowedTypes={['credit', 'debit', 'neutral']}
                        />
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button onClick={handleCancel} variant="outlined">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return [AccountSelectionDialog, confirm];
};
