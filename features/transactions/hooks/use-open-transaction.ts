import { create } from 'zustand';

type OpenTransactionState = {
    id?: string;
    isOpen: boolean;
    initialTab?: 'details' | 'documents' | 'history';
    onOpen: (
        id: string,
        initialTab?: 'details' | 'documents' | 'history',
    ) => void;
    onClose: () => void;
};

export const useOpenTransaction = create<OpenTransactionState>((set) => ({
    id: undefined,
    isOpen: false,
    initialTab: undefined,
    onOpen: (id: string, initialTab?: 'details' | 'documents' | 'history') =>
        set({ isOpen: true, id, initialTab: initialTab ?? 'details' }),
    onClose: () => set({ isOpen: false, id: undefined, initialTab: undefined }),
}));
