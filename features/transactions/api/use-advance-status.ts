import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';
import { convertAmountToMiliunits } from '@/lib/utils';

type ResponseType = InferResponseType<
    (typeof client.api.transactions)[':id']['$patch']
>;

type TransactionStatus = 'draft' | 'pending' | 'completed' | 'reconciled';

const STATUS_ORDER: TransactionStatus[] = [
    'draft',
    'pending',
    'completed',
    'reconciled',
];

/**
 * Hook to advance a transaction's status to the next state.
 * Handles fetching current transaction data and updating status.
 */
export const useAdvanceStatus = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        {
            transactionId: string;
            currentStatus: TransactionStatus;
            // Transaction data needed for the PATCH request
            transactionData: {
                date: Date | string;
                amount: number;
                payee?: string | null;
                payeeCustomerId?: string | null;
                notes?: string | null;
                accountId?: string | null;
                creditAccountId?: string | null;
                debitAccountId?: string | null;
                categoryId?: string | null;
                splitGroupId?: string | null;
                splitType?: string | 'parent' | 'child' | null;
            };
        }
    >({
        mutationFn: async ({
            transactionId,
            currentStatus,
            transactionData,
        }) => {
            const currentIndex = STATUS_ORDER.indexOf(currentStatus);
            const nextStatus =
                currentIndex < STATUS_ORDER.length - 1
                    ? STATUS_ORDER[currentIndex + 1]
                    : null;

            if (!nextStatus) {
                throw new Error('Transaction is already at final status');
            }

            // Validate split type
            const dataSplitType: 'parent' | 'child' | null =
                transactionData.splitType
                    ? transactionData.splitType === 'parent'
                        ? 'parent'
                        : 'child'
                    : null;

            const response = await client.api.transactions[':id'].$patch({
                json: {
                    date: new Date(transactionData.date),
                    amount:
                        typeof transactionData.amount === 'number'
                            ? convertAmountToMiliunits(transactionData.amount)
                            : transactionData.amount,
                    payee: transactionData.payee ?? undefined,
                    payeeCustomerId:
                        transactionData.payeeCustomerId ?? undefined,
                    notes: transactionData.notes ?? undefined,
                    accountId: transactionData.accountId ?? undefined,
                    creditAccountId:
                        transactionData.creditAccountId ?? undefined,
                    debitAccountId: transactionData.debitAccountId ?? undefined,
                    categoryId: transactionData.categoryId ?? undefined,
                    status: nextStatus,
                    splitGroupId: transactionData.splitGroupId ?? undefined,
                    splitType: dataSplitType ?? undefined,
                },
                param: { id: transactionId },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage =
                    (errorData as { error?: string })?.error ||
                    'Failed to advance status.';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (_, variables) => {
            const currentIndex = STATUS_ORDER.indexOf(variables.currentStatus);
            const nextStatus = STATUS_ORDER[currentIndex + 1];
            toast.success(`Status advanced to ${nextStatus}`);
            queryClient.invalidateQueries({
                queryKey: ['transaction', { id: variables.transactionId }],
            });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to advance status.');
        },
    });

    return mutation;
};

/**
 * Helper to get the next status for a transaction
 */
export const getNextStatus = (
    currentStatus: TransactionStatus,
): TransactionStatus | null => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    return currentIndex < STATUS_ORDER.length - 1
        ? STATUS_ORDER[currentIndex + 1]
        : null;
};

/**
 * Helper to check if status can be advanced
 */
export const canAdvanceStatus = (currentStatus: TransactionStatus): boolean => {
    return getNextStatus(currentStatus) !== null;
};
