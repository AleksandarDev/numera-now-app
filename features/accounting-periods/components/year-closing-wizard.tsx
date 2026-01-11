import { format } from 'date-fns';
import { useState } from 'react';
import { AccountSelect } from '@/components/account-select';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useCloseAccountingPeriod } from '@/features/accounting-periods/api/use-close-accounting-period';
import { useCreateAccountingPeriod } from '@/features/accounting-periods/api/use-create-accounting-period';
import { useCreateClosingEntries } from '@/features/accounting-periods/api/use-create-closing-entries';
import { usePreviewClosing } from '@/features/accounting-periods/api/use-preview-closing';
import { useYearClosingWizard } from '@/features/accounting-periods/hooks/use-year-closing-wizard';
import { useGetAccounts } from '@/features/accounts/api/use-get-accounts';

export const YearClosingWizard = () => {
    const { isOpen, onClose } = useYearClosingWizard();
    const [step, setStep] = useState(1);
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [profitAndLossAccountId, setProfitAndLossAccountId] = useState('');
    const [retainedEarningsAccountId, setRetainedEarningsAccountId] =
        useState('');
    const [closingDate, setClosingDate] = useState<Date>();
    const [createdPeriodId, setCreatedPeriodId] = useState<string>();

    const { data: accounts } = useGetAccounts({ pageSize: 100 });
    const createPeriodMutation = useCreateAccountingPeriod();
    const previewMutation = usePreviewClosing();
    const createEntriesMutation = useCreateClosingEntries();
    const closePeriodMutation = useCloseAccountingPeriod();

    const previewData =
        previewMutation.data && 'data' in previewMutation.data
            ? previewMutation.data.data
            : undefined;

    const handleClose = () => {
        onClose();
        setStep(1);
        setStartDate(undefined);
        setEndDate(undefined);
        setProfitAndLossAccountId('');
        setRetainedEarningsAccountId('');
        setClosingDate(undefined);
        setCreatedPeriodId(undefined);
        previewMutation.reset();
    };

    const handleStep1Next = () => {
        if (!startDate || !endDate) return;

        createPeriodMutation.mutate(
            {
                startDate,
                endDate,
                status: 'open',
            },
            {
                onSuccess: (response) => {
                    setCreatedPeriodId(response.data.id);
                    setStep(2);
                },
            },
        );
    };

    const handleStep2Next = () => {
        if (!startDate || !endDate || !profitAndLossAccountId) return;

        previewMutation.mutate(
            {
                startDate,
                endDate,
                profitAndLossAccountId,
                retainedEarningsAccountId:
                    retainedEarningsAccountId || undefined,
            },
            {
                onSuccess: () => {
                    setStep(3);
                },
            },
        );
    };

    const handleStep3Next = () => {
        if (!createdPeriodId || !profitAndLossAccountId || !closingDate) return;

        createEntriesMutation.mutate(
            {
                periodId: createdPeriodId,
                profitAndLossAccountId,
                retainedEarningsAccountId:
                    retainedEarningsAccountId || undefined,
                closingDate,
                transactionStatus: 'completed',
            },
            {
                onSuccess: () => {
                    setStep(4);
                },
            },
        );
    };

    const handleStep4Finish = () => {
        if (!createdPeriodId) return;

        closePeriodMutation.mutate(
            {
                id: createdPeriodId,
                notes: `Closed period from ${format(startDate ?? new Date(), 'yyyy-MM-dd')} to ${format(endDate ?? new Date(), 'yyyy-MM-dd')}`,
            },
            {
                onSuccess: () => {
                    handleClose();
                },
            },
        );
    };

    const equityAccounts =
        accounts?.filter((acc) => acc.accountClass === 'equity') || [];

    return (
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent className="flex flex-col h-full p-0 overflow-y-auto sm:max-w-2xl">
                <div className="px-6 pt-6">
                    <SheetHeader>
                        <SheetTitle>Year Closing Wizard</SheetTitle>
                        <SheetDescription>
                            Close your fiscal year by creating closing entries
                            and locking the period.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Step 1: Select Period */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                                Step 1: Select Period
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="block text-sm font-medium mb-2">
                                        Start Date
                                    </div>
                                    <DatePicker
                                        value={startDate}
                                        onChange={setStartDate}
                                        placeholder="Select start date"
                                    />
                                </div>
                                <div>
                                    <div className="block text-sm font-medium mb-2">
                                        End Date
                                    </div>
                                    <DatePicker
                                        value={endDate}
                                        onChange={setEndDate}
                                        placeholder="Select end date"
                                    />
                                </div>
                                <Button
                                    onClick={handleStep1Next}
                                    disabled={
                                        !startDate ||
                                        !endDate ||
                                        createPeriodMutation.isPending
                                    }
                                >
                                    {createPeriodMutation.isPending
                                        ? 'Creating...'
                                        : 'Next'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Configure Closing */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                                Step 2: Configure Closing
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="block text-sm font-medium mb-2">
                                        Profit and Loss Account *
                                    </div>
                                    <AccountSelect
                                        value={profitAndLossAccountId}
                                        onChange={setProfitAndLossAccountId}
                                        accounts={equityAccounts}
                                    />
                                </div>
                                <div>
                                    <div className="block text-sm font-medium mb-2">
                                        Retained Earnings Account (Optional)
                                    </div>
                                    <AccountSelect
                                        value={retainedEarningsAccountId}
                                        onChange={setRetainedEarningsAccountId}
                                        accounts={equityAccounts}
                                    />
                                </div>
                                <div>
                                    <div className="block text-sm font-medium mb-2">
                                        Closing Date
                                    </div>
                                    <DatePicker
                                        value={closingDate || endDate}
                                        onChange={setClosingDate}
                                        placeholder="Select closing date"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleStep2Next}
                                        disabled={
                                            !profitAndLossAccountId ||
                                            previewMutation.isPending
                                        }
                                    >
                                        {previewMutation.isPending
                                            ? 'Loading...'
                                            : 'Preview'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 3 && previewData && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                                Step 3: Preview
                            </h3>
                            <div className="space-y-4">
                                <div className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="font-medium">
                                            Total Income:
                                        </span>
                                        <span>
                                            {(
                                                previewData.totalIncome / 100
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">
                                            Total Expenses:
                                        </span>
                                        <span>
                                            {(
                                                previewData.totalExpenses / 100
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2 font-bold">
                                        <span>Net Result:</span>
                                        <span>
                                            {(
                                                previewData.netResult / 100
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    {previewData.incomeAccounts.length} income
                                    account(s) and{' '}
                                    {previewData.expenseAccounts.length} expense
                                    account(s) will be closed.
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(2)}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleStep3Next}
                                        disabled={
                                            createEntriesMutation.isPending
                                        }
                                    >
                                        {createEntriesMutation.isPending
                                            ? 'Creating...'
                                            : 'Create Entries'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirm and Close */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                                Step 4: Lock Period
                            </h3>
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Closing entries have been created
                                    successfully. Click below to lock the period
                                    and prevent further modifications.
                                </p>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Warning:</strong> Once the
                                        period is closed, transactions within
                                        this period cannot be created, edited,
                                        or deleted.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleClose}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleStep4Finish}
                                        disabled={closePeriodMutation.isPending}
                                    >
                                        {closePeriodMutation.isPending
                                            ? 'Closing...'
                                            : 'Lock Period'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
