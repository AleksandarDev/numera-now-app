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
    categoryId?: string;
    notes?: string;
};

type DebitEntry = {
    accountId: string;
    amount: string;
    categoryId?: string;
    notes?: string;
};

type UnifiedTransactionInput = {
    date: Date;
    payeeCustomerId?: string;
    notes?: string;
    categoryId?: string;
    creditEntries: CreditEntry[];
    debitEntries: DebitEntry[];
};

export const useCreateUnifiedTransaction = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation<
        TransactionResponseType | SplitTransactionResponseType,
        Error,
        UnifiedTransactionInput
    >({
        mutationFn: async (input) => {
            const { creditEntries, debitEntries, ...baseTransaction } = input;
            const isSingleEntry =
                creditEntries.length === 1 && debitEntries.length === 1;

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
                        categoryId:
                            creditEntries[0].categoryId ||
                            baseTransaction.categoryId ||
                            undefined,
                        creditAccountId: creditEntries[0].accountId,
                        debitAccountId: debitEntries[0].accountId,
                        amount,
                        status: 'draft',
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
                    categoryId?: string;
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
                        categoryId: credit.categoryId,
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
                        categoryId: debit.categoryId,
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
                            categoryId: baseTransaction.categoryId || undefined,
                            amount: totalAmount,
                            status: 'draft',
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
        onSuccess: () => {
            toast.success('Transaction created.');
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['summary'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create transaction.');
        },
    });

    return mutation;
};
