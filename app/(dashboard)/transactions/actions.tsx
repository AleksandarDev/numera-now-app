'use client';

import {
    ArrowRight,
    Copy,
    Edit,
    MoreHorizontal,
    Paperclip,
    Trash,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    canAdvanceStatus,
    getNextStatus,
    useAdvanceStatus,
} from '@/features/transactions/api/use-advance-status';
import { useDeleteTransaction } from '@/features/transactions/api/use-delete-transaction';
import { useNewTransaction } from '@/features/transactions/hooks/use-new-transaction';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { useConfirm } from '@/hooks/use-confirm';

type TransactionStatus = 'draft' | 'pending' | 'completed' | 'reconciled';

const STATUS_LABELS: Record<TransactionStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    completed: 'Completed',
    reconciled: 'Reconciled',
};

type ActionsProps = {
    transaction: {
        id: string;
        date?: Date | string | null;
        amount?: number | null;
        payeeCustomerId?: string | null;
        payee?: string | null;
        notes?: string | null;
        status?: string | null;
        accountId?: string | null;
        creditAccountId?: string | null;
        debitAccountId?: string | null;
        splitGroupId?: string | null;
        splitType?: string | null;
        tags?: Array<{
            id: string;
            name: string;
            color?: string | null;
        }> | null;
    };
};

export const Actions = ({ transaction }: ActionsProps) => {
    const deleteMutation = useDeleteTransaction(transaction.id);
    const advanceStatusMutation = useAdvanceStatus();
    const { onOpen } = useOpenTransaction();
    const { onOpen: onOpenNew } = useNewTransaction();

    const [ConfirmDialog, confirm] = useConfirm(
        'Are you sure?',
        'You are about to delete this transaction.',
    );

    const handleDuplicate = () => {
        // Amount is already converted from milliunits by useGetTransactions
        const amount = transaction.amount
            ? Math.abs(transaction.amount).toString()
            : '0';

        // Prepare default values for the new transaction form
        const defaultValues = {
            date: new Date(),
            payeeCustomerId: transaction.payeeCustomerId ?? '',
            notes: transaction.notes ?? '',
            tagIds: transaction.tags?.map((t) => t.id) ?? [],
            creditEntries: transaction.creditAccountId
                ? [
                      {
                          accountId: transaction.creditAccountId,
                          amount,
                          notes: '',
                      },
                  ]
                : [{ accountId: '', amount: '', notes: '' }],
            debitEntries: transaction.debitAccountId
                ? [
                      {
                          accountId: transaction.debitAccountId,
                          amount,
                          notes: '',
                      },
                  ]
                : [{ accountId: '', amount: '', notes: '' }],
        };

        onOpenNew(defaultValues);
    };

    const handleDelete = async () => {
        const ok = await confirm();

        if (ok) {
            deleteMutation.mutate();
        }
    };

    const currentStatus = (transaction.status ??
        'pending') as TransactionStatus;
    const nextStatus = getNextStatus(currentStatus);
    const canAdvance = canAdvanceStatus(currentStatus);
    const isCompleted = currentStatus === 'reconciled';

    const handleAdvanceStatus = () => {
        if (!canAdvance || !nextStatus) return;

        advanceStatusMutation.mutate({
            transactionId: transaction.id,
            currentStatus,
            transactionData: {
                date: transaction.date
                    ? new Date(transaction.date)
                    : new Date(),
                amount: transaction.amount ?? 0,
                payee: transaction.payee,
                payeeCustomerId: transaction.payeeCustomerId,
                notes: transaction.notes,
                accountId: transaction.accountId,
                creditAccountId: transaction.creditAccountId,
                debitAccountId: transaction.debitAccountId,
                splitGroupId: transaction.splitGroupId,
                splitType: transaction.splitType,
            },
        });
    };

    const handleAttachDocuments = () => {
        // Open the edit sheet and navigate to documents tab
        onOpen(transaction.id, 'documents');
    };

    const isPending =
        deleteMutation.isPending || advanceStatusMutation.isPending;

    return (
        <>
            <ConfirmDialog />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="size-8 p-0">
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                    {/* Quick Actions */}
                    {canAdvance && nextStatus && (
                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={handleAdvanceStatus}
                        >
                            <ArrowRight className="mr-2 size-4" />
                            Advance to {STATUS_LABELS[nextStatus]}
                        </DropdownMenuItem>
                    )}

                    {!isCompleted && (
                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={handleAttachDocuments}
                        >
                            <Paperclip className="mr-2 size-4" />
                            Attach Documents
                        </DropdownMenuItem>
                    )}

                    {(canAdvance || !isCompleted) && <DropdownMenuSeparator />}

                    {/* Standard Actions */}
                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={() => onOpen(transaction.id)}
                    >
                        <Edit className="mr-2 size-4" />
                        Edit
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={handleDuplicate}
                    >
                        <Copy className="mr-2 size-4" />
                        Duplicate
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        disabled={isPending}
                        onClick={handleDelete}
                    >
                        <Trash className="mr-2 size-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};
