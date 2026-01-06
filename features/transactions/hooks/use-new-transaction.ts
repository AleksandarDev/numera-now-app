import { create } from "zustand";

type NewTransactionState = {
  doubleEntry: boolean;
  isOpen: boolean;
  splitMode: boolean;
  prefillSplit?: {
    date?: Date;
    payeeCustomerId?: string;
    payee?: string;
    categoryId?: string | null;
    notes?: string | null;
    status?: string;
  };
  onOpen: (doubleEntry?: boolean) => void;
  onOpenSplit: (options?: { doubleEntry?: boolean; prefillSplit?: NewTransactionState["prefillSplit"] }) => void;
  onClose: () => void;
};

export const useNewTransaction = create<NewTransactionState>((set) => ({
  isOpen: false,
  doubleEntry: false,
  splitMode: false,
  onOpen: (doubleEntry) => set({ isOpen: true, doubleEntry: Boolean(doubleEntry), splitMode: false, prefillSplit: undefined }),
  onOpenSplit: (options) => set({
    isOpen: true,
    doubleEntry: Boolean(options?.doubleEntry),
    splitMode: true,
    prefillSplit: options?.prefillSplit,
  }),
  onClose: () => set({ isOpen: false, splitMode: false, prefillSplit: undefined }),
}));