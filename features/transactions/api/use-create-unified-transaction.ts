import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';
import { convertAmountToMiliunits } from '@/lib/utils';

type TransactionResponseType = InferResponseType<
    typeof client.api.transactions.$post
>;
type SplitTransactionResponseType = InferResponseType<
    (typeof client.api.transactions)['create-split']['$post']
>;

type CreditEntry = {
    accountId: string;
    amount: string;
    notes?: string;
};

type DebitEntry = {
    accountId: string;
    amount: string;
    notes?: string;
};

type UnifiedTransactionInput = {
    date: Date;
    payeeCustomerId?: string;
    notes?: string;
    tagIds?: string[];
    creditEntries: CreditEntry[];
    debitEntries: DebitEntry[];
};

export const useCreateUnifiedTransaction = (
    onOpen?: (id: string, tab?: 'details' | 'documents' | 'history') => void,
    onCloseNew?: () => void,
) => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        TransactionResponseType | SplitTransactionResponseType,
        Error,
        UnifiedTransactionInput
    >({
        mutationFn: async (input) => {
            const cachedSettings = queryClient.getQueryData(['settings']) as
                | {
                      autoDraftToPending?: boolean;
                  }
                | undefined;
            const autoDraftToPending =
                cachedSettings?.autoDraftToPending ?? false;

            const { creditEntries, debitEntries, ...baseTransaction } = input;
            const isSingleEntry =
                creditEntries.length === 1 && debitEntries.length === 1;

            const shouldAutoPromoteDraftToPending =
                autoDraftToPending && !!baseTransaction.payeeCustomerId;
            const status = shouldAutoPromoteDraftToPending
                ? 'pending'
                : 'draft';

            if (isSingleEntry) {
                // Single transaction - use regular endpoint
                const amount = convertAmountToMiliunits(
                    parseFloat(creditEntries[0].amount || '0'),
                );

                const response = await client.api.transactions.$post({
                    json: {
                        date: baseTransaction.date,
                        payeeCustomerId:
                            baseTransaction.payeeCustomerId || undefined,
                        notes: baseTransaction.notes || undefined,
                        tagIds: baseTransaction.tagIds || undefined,
                        creditAccountId: creditEntries[0].accountId,
                        debitAccountId: debitEntries[0].accountId,
                        amount,
                        status,
                    },
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        (error as { error?: string }).error ||
                            'Failed to create transaction.',
                    );
                }

                return await response.json();
            } else {
                // Split transaction - use create-split endpoint
                // For split transactions, we need to create individual splits
                const splits: Array<{
                    amount: number;
                    creditAccountId?: string;
                    debitAccountId?: string;
                    notes?: string;
                }> = [];

                // Process credit entries
                for (const credit of creditEntries) {
                    const amount = convertAmountToMiliunits(
                        parseFloat(credit.amount || '0'),
                    );
                    // For credits, we need a corresponding debit
                    // In a split scenario, we pair with the first debit account
                    splits.push({
                        amount,
                        creditAccountId: credit.accountId,
                        debitAccountId: debitEntries[0].accountId, // Use first debit as the "main" account
                        notes: credit.notes,
                    });
                }

                // Process additional debit entries (if more than one)
                for (let i = 1; i < debitEntries.length; i++) {
                    const debit = debitEntries[i];
                    const amount = convertAmountToMiliunits(
                        parseFloat(debit.amount || '0'),
                    );
                    splits.push({
                        amount,
                        creditAccountId: creditEntries[0].accountId, // Use first credit as the "main" account
                        debitAccountId: debit.accountId,
                        notes: debit.notes,
                    });
                }

                // Calculate total for parent transaction
                const totalAmount = creditEntries.reduce(
                    (sum, entry) =>
                        sum +
                        convertAmountToMiliunits(
                            parseFloat(entry.amount || '0'),
                        ),
                    0,
                );

                const response = await client.api.transactions[
                    'create-split'
                ].$post({
                    json: {
                        parentTransaction: {
                            date: baseTransaction.date,
                            payeeCustomerId:
                                baseTransaction.payeeCustomerId || undefined,
                            notes: baseTransaction.notes || undefined,
                            tagIds: baseTransaction.tagIds || undefined,
                            amount: totalAmount,
                            status,
                        },
                        splits,
                    },
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        (error as { error?: string }).error ||
                            'Failed to create split transaction.',
                    );
                }

                return await response.json();
            }
        },
        onSuccess: (data) => {
            toast.success('Transaction created.');
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });

            // Extract the transaction ID from the response
            // For single transactions, data.data is the transaction object
            // For split transactions, data.data has parent and children
            let transactionId: string | undefined;
            if ('data' in data) {
                if ('parent' in data.data) {
                    // Split transaction - use parent ID
                    transactionId = data.data.parent.id;
                } else {
                    // Single transaction
                    transactionId = data.data.id;
                }
            }

            // Close the new transaction sheet and open edit sheet
            if (transactionId) {
                if (onCloseNew) {
                    onCloseNew();
                }
                if (onOpen) {
                    onOpen(transactionId, 'details');
                }
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create transaction.');
        },
    });

    return mutation;
};
