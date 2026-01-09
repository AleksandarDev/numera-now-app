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

type NewTransactionTab = 'details' | 'import' | 'documents';

type NewTransactionState = {
    defaultValues?: TransactionDefaultValues;
    defaultTab?: NewTransactionTab;
    setDefaultValues: (defaultValues?: TransactionDefaultValues) => void;
    setDefaultTab: (tab?: NewTransactionTab) => void;
};

const useNewTransactionStore = create<NewTransactionState>((set) => ({
    defaultValues: undefined,
    defaultTab: undefined,
    setDefaultValues: (defaultValues?: TransactionDefaultValues) =>
        set({ defaultValues }),
    setDefaultTab: (defaultTab?: NewTransactionTab) => set({ defaultTab }),
}));

export const useNewTransaction = () => {
    const [newTransactionParam, setNewTransactionParam] = useQueryState(
        'newTransaction',
        parseAsString,
    );
    const { defaultValues, defaultTab, setDefaultValues, setDefaultTab } =
        useNewTransactionStore();

    return {
        isOpen: newTransactionParam === '1',
        defaultValues,
        defaultTab,
        onOpen: (
            values?: TransactionDefaultValues,
            tab?: NewTransactionTab,
        ) => {
            setDefaultValues(values);
            setDefaultTab(tab);
            void setNewTransactionParam('1');
        },
        onClose: () => {
            setDefaultValues(undefined);
            setDefaultTab(undefined);
            void setNewTransactionParam(null);
        },
    };
};
