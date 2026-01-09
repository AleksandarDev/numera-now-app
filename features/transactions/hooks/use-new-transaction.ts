'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { create } from 'zustand';

type TransactionDefaultValues = {
    date?: Date;
    payeeCustomerId?: string;
    notes?: string;
    tagIds?: string[];
    creditEntries?: {
        accountId: string;
        amount: string;
        notes: string;
    }[];
    debitEntries?: {
        accountId: string;
        amount: string;
        notes: string;
    }[];
};

type NewTransactionState = {
    defaultValues?: TransactionDefaultValues;
    setDefaultValues: (defaultValues?: TransactionDefaultValues) => void;
};

const useNewTransactionStore = create<NewTransactionState>((set) => ({
    defaultValues: undefined,
    setDefaultValues: (defaultValues?: TransactionDefaultValues) =>
        set({ defaultValues }),
}));

export const useNewTransaction = () => {
    const [newTransactionParam, setNewTransactionParam] = useQueryState(
        'newTransaction',
        parseAsString,
    );
    const { defaultValues, setDefaultValues } = useNewTransactionStore();

    return {
        isOpen: newTransactionParam === '1',
        defaultValues,
        onOpen: (values?: TransactionDefaultValues) => {
            setDefaultValues(values);
            void setNewTransactionParam('1');
        },
        onClose: () => {
            setDefaultValues(undefined);
            void setNewTransactionParam(null);
        },
    };
};
