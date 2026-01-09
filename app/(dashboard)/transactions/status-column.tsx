'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGetSettings } from '@/features/settings/api/use-get-settings';
import {
    canAdvanceStatus,
    getNextStatus,
    useAdvanceStatus,
} from '@/features/transactions/api/use-advance-status';
import { cn } from '@/lib/utils';

type TransactionStatus = 'draft' | 'pending' | 'completed' | 'reconciled';

const STATUS_LABELS: Record<TransactionStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    completed: 'Completed',
    reconciled: 'Reconciled',
};

type StatusColumnProps = {
    transactionId: string;
    status: string;
    transaction: {
        date?: Date | string | null;
        amount?: number | null;
        payeeCustomerId?: string | null;
        payee?: string | null;
        notes?: string | null;
        accountId?: string | null;
        creditAccountId?: string | null;
        debitAccountId?: string | null;
        splitGroupId?: string | null;
        splitType?: string | null;
    };
    // Document-related props for status progression validation
    hasAllRequiredDocuments?: boolean;
    requiredDocumentTypes?: number;
    attachedRequiredTypes?: number;
    minRequiredDocuments?: number;
};

export const StatusColumn = ({
    transactionId,
    status,
    transaction,
    hasAllRequiredDocuments = true,
    requiredDocumentTypes = 0,
    attachedRequiredTypes = 0,
    minRequiredDocuments = 0,
}: StatusColumnProps) => {
    const advanceStatusMutation = useAdvanceStatus();
    const settingsQuery = useGetSettings();

    const currentStatus = (status ?? 'pending') as TransactionStatus;
    const nextStatus = getNextStatus(currentStatus);
    const canAdvance = canAdvanceStatus(currentStatus);

    const autoDraftToPending = settingsQuery.data?.autoDraftToPending ?? false;
    const isAutoDraftToPendingBlocked =
        autoDraftToPending &&
        currentStatus === 'draft' &&
        nextStatus === 'pending';

    // Check if status progression is blocked by document requirements
    const isDocumentBlockedForReconciliation = (): {
        blocked: boolean;
        message: string;
    } => {
        // Only block when trying to progress to "reconciled"
        if (nextStatus !== 'reconciled') {
            return { blocked: false, message: '' };
        }

        // No required document types - not blocked
        if (requiredDocumentTypes === 0) {
            return { blocked: false, message: '' };
        }

        // Documents requirement already met
        if (hasAllRequiredDocuments) {
            return { blocked: false, message: '' };
        }

        // Documents are missing - determine the appropriate message
        if (minRequiredDocuments === 0) {
            const missing = requiredDocumentTypes - attachedRequiredTypes;
            return {
                blocked: true,
                message: `Missing ${missing} required document type${missing > 1 ? 's' : ''}. Attach all required documents before reconciling.`,
            };
        } else {
            const needed = Math.min(
                minRequiredDocuments,
                requiredDocumentTypes,
            );
            return {
                blocked: true,
                message: `Need at least ${needed} of ${requiredDocumentTypes} required document type${requiredDocumentTypes > 1 ? 's' : ''} attached (currently ${attachedRequiredTypes}).`,
            };
        }
    };

    const documentBlock = isDocumentBlockedForReconciliation();

    const statusVariants = {
        draft: 'secondary',
        pending: 'outline',
        completed: 'outline',
        reconciled: 'outline',
    } as const;

    const statusColors = {
        draft: 'text-muted-foreground',
        pending: 'text-yellow-600',
        completed: 'text-blue-600',
        reconciled: 'text-green-600',
    } as const;

    const handleAdvanceStatus = () => {
        if (!canAdvance || !nextStatus) return;

        // Check document requirements before allowing advancement
        if (documentBlock.blocked) {
            toast.error(documentBlock.message);
            return;
        }

        advanceStatusMutation.mutate({
            transactionId,
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

    const isPending = advanceStatusMutation.isPending;

    // If cannot advance, just show the badge without dropdown
    if (!canAdvance || !nextStatus || isAutoDraftToPendingBlocked) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant={statusVariants[currentStatus] || 'outline'}
                            data-row-interactive="true"
                            className={`${statusColors[currentStatus] || ''}`}
                        >
                            {currentStatus
                                ? currentStatus.charAt(0).toUpperCase() +
                                  currentStatus.slice(1)
                                : 'Pending'}
                        </Badge>
                    </TooltipTrigger>
                    {isAutoDraftToPendingBlocked && (
                        <TooltipContent className="max-w-xs">
                            <p>
                                Automatic status is enabled for Draft  Pending.
                                Fill required fields and save to move to
                                Pending.
                            </p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        );
    }

    // If can advance, show badge with dropdown
    // If blocked by documents, show warning indicator
    return (
        <TooltipProvider>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Badge
                                variant={
                                    statusVariants[currentStatus] || 'outline'
                                }
                                data-row-interactive="true"
                                className={cn(
                                    statusColors[currentStatus] || '',
                                    'cursor-pointer hover:opacity-80 transition-opacity',
                                    documentBlock.blocked && 'border-amber-300',
                                )}
                            >
                                {documentBlock.blocked && (
                                    <AlertCircle className="mr-1 h-3 w-3 text-amber-500" />
                                )}
                                {currentStatus
                                    ? currentStatus.charAt(0).toUpperCase() +
                                      currentStatus.slice(1)
                                    : 'Pending'}
                            </Badge>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    {documentBlock.blocked && (
                        <TooltipContent className="max-w-xs">
                            <p className="text-amber-600">
                                {documentBlock.message}
                            </p>
                        </TooltipContent>
                    )}
                </Tooltip>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem
                        disabled={isPending || documentBlock.blocked}
                        onClick={handleAdvanceStatus}
                        className={cn(
                            documentBlock.blocked && 'text-muted-foreground',
                        )}
                    >
                        <ArrowRight className="mr-2 size-4" />
                        {documentBlock.blocked ? (
                            <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                                Documents required
                            </span>
                        ) : (
                            `Advance to ${STATUS_LABELS[nextStatus]}`
                        )}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    );
};
