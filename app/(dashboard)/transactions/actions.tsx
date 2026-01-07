"use client";

import { Edit, MoreHorizontal, Trash, ArrowRight, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteTransaction } from "@/features/transactions/api/use-delete-transaction";
import { useAdvanceStatus, getNextStatus, canAdvanceStatus } from "@/features/transactions/api/use-advance-status";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { useConfirm } from "@/hooks/use-confirm";

type TransactionStatus = "draft" | "pending" | "completed" | "reconciled";

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  completed: "Completed",
  reconciled: "Reconciled",
};

type ActionsProps = {
  transaction: {
    id: string;
    date?: Date | string | null;
    amount?: number | null;
    payeeCustomerId?: string | null;
    payee?: string | null;
    categoryId?: string | null;
    notes?: string | null;
    status?: string | null;
    accountId?: string | null;
    creditAccountId?: string | null;
    debitAccountId?: string | null;
    splitGroupId?: string | null;
    splitType?: string | null;
  };
};

export const Actions = ({ transaction }: ActionsProps) => {
  const deleteMutation = useDeleteTransaction(transaction.id);
  const advanceStatusMutation = useAdvanceStatus();
  const { onOpen } = useOpenTransaction();

  const [ConfirmDialog, confirm] = useConfirm(
    "Are you sure?",
    "You are about to delete this transaction."
  );

  const handleDelete = async () => {
    const ok = await confirm();

    if (ok) {
      deleteMutation.mutate();
    }
  };

  const currentStatus = (transaction.status ?? "pending") as TransactionStatus;
  const nextStatus = getNextStatus(currentStatus);
  const canAdvance = canAdvanceStatus(currentStatus);
  const isCompleted = currentStatus === "reconciled";

  const handleAdvanceStatus = () => {
    if (!canAdvance || !nextStatus) return;

    advanceStatusMutation.mutate({
      transactionId: transaction.id,
      currentStatus,
      transactionData: {
        date: transaction.date ? new Date(transaction.date) : new Date(),
        amount: transaction.amount ?? 0,
        payee: transaction.payee,
        payeeCustomerId: transaction.payeeCustomerId,
        notes: transaction.notes,
        accountId: transaction.accountId,
        creditAccountId: transaction.creditAccountId,
        debitAccountId: transaction.debitAccountId,
        categoryId: transaction.categoryId,
        splitGroupId: transaction.splitGroupId,
        splitType: transaction.splitType,
      },
    });
  };

  const handleAttachDocuments = () => {
    // Open the edit sheet and navigate to documents tab
    onOpen(transaction.id, "documents");
  };

  const isPending = deleteMutation.isPending || advanceStatusMutation.isPending;

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