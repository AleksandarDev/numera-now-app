"use client";

import { Edit, MoreHorizontal, Split, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteTransaction } from "@/features/transactions/api/use-delete-transaction";
import { useOpenTransaction } from "@/features/transactions/hooks/use-open-transaction";
import { useNewTransaction } from "@/features/transactions/hooks/use-new-transaction";
import { useConfirm } from "@/hooks/use-confirm";

type ActionsProps = {
  transaction: {
    id: string;
    date?: Date | string | null;
    payeeCustomerId?: string | null;
    payee?: string | null;
    categoryId?: string | null;
    notes?: string | null;
    status?: string | null;
    creditAccountId?: string | null;
    debitAccountId?: string | null;
  };
};

const getPrefillStatus = (
  status: ActionsProps["transaction"]["status"]
): "draft" | "pending" | "completed" | "reconciled" => {
  if (
    status === "draft" ||
    status === "pending" ||
    status === "completed" ||
    status === "reconciled"
  ) {
    return status;
  }

  return "pending" as const;
};

export const Actions = ({ transaction }: ActionsProps) => {
  const deleteMutation = useDeleteTransaction(transaction.id);
  const { onOpen } = useOpenTransaction();
  const { onOpenSplit } = useNewTransaction();

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
          <DropdownMenuItem
            disabled={deleteMutation.isPending}
            onClick={() => onOpen(transaction.id)}
          >
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onOpenSplit({
              doubleEntry: Boolean(transaction.creditAccountId && transaction.debitAccountId),
              prefillSplit: {
                date: transaction.date ? new Date(transaction.date) : undefined,
                payeeCustomerId: transaction.payeeCustomerId ?? undefined,
                payee: transaction.payee ?? undefined,
                categoryId: transaction.categoryId ?? undefined,
                notes: transaction.notes ?? undefined,
                status: getPrefillStatus(transaction.status),
              },
            })}
            disabled={deleteMutation.isPending}
          >
            <Split className="mr-2 size-4" />
            Split this transaction
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={deleteMutation.isPending}
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