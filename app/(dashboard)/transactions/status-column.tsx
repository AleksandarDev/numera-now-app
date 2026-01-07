"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdvanceStatus, getNextStatus, canAdvanceStatus } from "@/features/transactions/api/use-advance-status";

type TransactionStatus = "draft" | "pending" | "completed" | "reconciled";

const STATUS_LABELS: Record<TransactionStatus, string> = {
    draft: "Draft",
    pending: "Pending",
    completed: "Completed",
    reconciled: "Reconciled",
};

type StatusColumnProps = {
    transactionId: string;
    status: string;
    transaction: {
        date?: Date | string | null;
        amount?: number | null;
        payeeCustomerId?: string | null;
        payee?: string | null;
        categoryId?: string | null;
        notes?: string | null;
        accountId?: string | null;
        creditAccountId?: string | null;
        debitAccountId?: string | null;
        splitGroupId?: string | null;
        splitType?: string | null;
    };
};

export const StatusColumn = ({ transactionId, status, transaction }: StatusColumnProps) => {
    const advanceStatusMutation = useAdvanceStatus();

    const currentStatus = (status ?? "pending") as TransactionStatus;
    const nextStatus = getNextStatus(currentStatus);
    const canAdvance = canAdvanceStatus(currentStatus);

    const statusVariants = {
        draft: "secondary",
        pending: "outline",
        completed: "outline",
        reconciled: "outline",
    } as const;

    const statusColors = {
        draft: "text-muted-foreground",
        pending: "text-yellow-600",
        completed: "text-blue-600",
        reconciled: "text-green-600",
    } as const;

    const handleAdvanceStatus = () => {
        if (!canAdvance || !nextStatus) return;

        advanceStatusMutation.mutate({
            transactionId,
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

    const isPending = advanceStatusMutation.isPending;

    // If cannot advance, just show the badge without dropdown
    if (!canAdvance || !nextStatus) {
        return (
            <Badge
                variant={statusVariants[currentStatus] || "outline"}
                className={`${statusColors[currentStatus] || ""}`}
            >
                {currentStatus ? currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1) : "Pending"}
            </Badge>
        );
    }

    // If can advance, show badge with dropdown
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Badge
                    variant={statusVariants[currentStatus] || "outline"}
                    className={`${statusColors[currentStatus] || ""} cursor-pointer hover:opacity-80 transition-opacity`}
                >
                    {currentStatus ? currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1) : "Pending"}
                </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem
                    disabled={isPending}
                    onClick={handleAdvanceStatus}
                >
                    <ArrowRight className="mr-2 size-4" />
                    Advance to {STATUS_LABELS[nextStatus]}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
