'use client';

import { parseAsString, useQueryState } from 'nuqs';

type TransactionTab = 'details' | 'documents' | 'history';

const isTransactionTab = (value: string | null): value is TransactionTab =>
    value === 'details' || value === 'documents' || value === 'history';

export const useOpenTransaction = () => {
    const [transactionId, setTransactionId] = useQueryState(
        'transactionId',
        parseAsString,
    );
    const [transactionTab, setTransactionTab] = useQueryState(
        'transactionTab',
        parseAsString,
    );

    const initialTab = isTransactionTab(transactionTab)
        ? transactionTab
        : undefined;

    return {
        id: transactionId ?? undefined,
        isOpen: Boolean(transactionId),
        initialTab,
        tab: initialTab,
        setTab: (tab?: TransactionTab) => setTransactionTab(tab ?? null),
        onOpen: (id: string, tab?: TransactionTab) => {
            void setTransactionId(id);
            void setTransactionTab(tab ?? 'details');
        },
        onClose: () => {
            void setTransactionId(null);
            void setTransactionTab(null);
        },
    };
};
