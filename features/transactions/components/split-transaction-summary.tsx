import { Button } from '@signalco/ui-primitives/Button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

type SplitTransactionStatus = 'draft' | 'pending' | 'completed' | 'reconciled';

export type SplitTransactionSummaryItem = {
    id: string;
    date?: string | Date | null;
    payee?: string | null;
    payeeCustomerName?: string | null;
    amount?: number | null;
    status?: string | null;
    account?: string | null;
    accountCode?: string | null;
    creditAccount?: string | null;
    creditAccountCode?: string | null;
    debitAccount?: string | null;
    debitAccountCode?: string | null;
    notes?: string | null;
    splitType?: string | null;
};

type SplitTransactionSummaryProps = {
    transaction?: SplitTransactionSummaryItem | null;
    parts: SplitTransactionSummaryItem[];
    status?: string | null;
    totalAmount?: number | null;
    documentCount?: number;
    currentTransactionId?: string | null;
    onOpenTransaction?: (id: string) => void;
};

const statusColors: Record<SplitTransactionStatus, string> = {
    draft: 'text-muted-foreground',
    pending: 'text-yellow-600',
    completed: 'text-blue-600',
    reconciled: 'text-green-600',
};

const getStatus = (status?: string | null): SplitTransactionStatus => {
    if (
        status === 'draft' ||
        status === 'pending' ||
        status === 'completed' ||
        status === 'reconciled'
    ) {
        return status;
    }

    return 'pending';
};

const formatStatusLabel = (status?: string | null) => {
    const normalized = getStatus(status);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDate = (date?: string | Date | null) => {
    if (!date) {
        return '-';
    }

    return new Date(date).toLocaleDateString();
};

const getCustomerLabel = (transaction: SplitTransactionSummaryItem) =>
    transaction.payeeCustomerName || transaction.payee || 'Untitled';

const getAccountLabel = (transaction: SplitTransactionSummaryItem) => {
    const credit = [transaction.creditAccountCode, transaction.creditAccount]
        .filter(Boolean)
        .join(' ');
    const debit = [transaction.debitAccountCode, transaction.debitAccount]
        .filter(Boolean)
        .join(' ');

    if (credit || debit) {
        return `${credit || '-'} -> ${debit || '-'}`;
    }

    return (
        [transaction.accountCode, transaction.account]
            .filter(Boolean)
            .join(' ') || 'No account'
    );
};

const getCustomerSummary = (parts: SplitTransactionSummaryItem[]) => {
    const customers = new Set<string>();
    for (const part of parts) {
        const label = part.payeeCustomerName || part.payee;
        if (label) {
            customers.add(label);
        }
    }

    const [first, ...rest] = [...customers];
    if (!first) {
        return '-';
    }

    return rest.length > 0 ? `${first} +${rest.length} more` : first;
};

export const SplitTransactionSummary = ({
    transaction,
    parts,
    status,
    totalAmount,
    documentCount,
    currentTransactionId,
    onOpenTransaction,
}: SplitTransactionSummaryProps) => {
    const displayStatus = getStatus(status ?? transaction?.status);
    const displayTotal =
        totalAmount ?? parts.reduce((sum, part) => sum + (part.amount ?? 0), 0);

    return (
        <div className="space-y-4">
            <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold">
                            Split summary
                        </div>
                        <div className="text-xs text-muted-foreground">
                            This transaction is part of a split group.
                        </div>
                    </div>
                    <Badge
                        variant="outline"
                        className={statusColors[displayStatus]}
                    >
                        {formatStatusLabel(displayStatus)}
                    </Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Date</span>
                        <span>{formatDate(transaction?.date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Customers</span>
                        <span className="truncate text-right">
                            {getCustomerSummary(parts)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                            Total amount
                        </span>
                        <span>{formatCurrency(displayTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Parts</span>
                        <span>{parts.length}</span>
                    </div>
                    {documentCount !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Documents
                            </span>
                            <span>{documentCount}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-hidden rounded-md border">
                <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
                    Split parts
                </div>
                {parts.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                        No parts found for this split group.
                    </div>
                ) : (
                    <div className="divide-y">
                        {parts.map((part, index) => {
                            const partStatus = getStatus(part.status);
                            const isCurrent = part.id === currentTransactionId;

                            return (
                                <div
                                    key={part.id}
                                    className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Part {index + 1}
                                            </span>
                                            {isCurrent && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    Current
                                                </Badge>
                                            )}
                                            <span className="truncate text-sm font-medium">
                                                {getCustomerLabel(part)}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span>{formatDate(part.date)}</span>
                                            <span>{getAccountLabel(part)}</span>
                                            {!!part.notes && (
                                                <span className="truncate">
                                                    {part.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {formatCurrency(
                                                    part.amount ?? 0,
                                                )}
                                            </div>
                                            <div
                                                className={`text-xs ${statusColors[partStatus]}`}
                                            >
                                                {formatStatusLabel(partStatus)}
                                            </div>
                                        </div>
                                        {onOpenTransaction && !isCurrent && (
                                            <Button
                                                type="button"
                                                variant="outlined"
                                                size="sm"
                                                onClick={() =>
                                                    onOpenTransaction(part.id)
                                                }
                                            >
                                                Open
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
