import { create } from "zustand";

type TransactionDefaultValues = {
  date?: Date;
  payeeCustomerId?: string;
  notes?: string;
  categoryId?: string;
  creditEntries?: { accountId: string; amount: string; categoryId: string; notes: string }[];
  debitEntries?: { accountId: string; amount: string; categoryId: string; notes: string }[];
};

type NewTransactionState = {
  isOpen: boolean;
  defaultValues?: TransactionDefaultValues;
  onOpen: (defaultValues?: TransactionDefaultValues) => void;
  onClose: () => void;
};

export const useNewTransaction = create<NewTransactionState>((set) => ({
  isOpen: false,
  defaultValues: undefined,
  onOpen: (defaultValues?: TransactionDefaultValues) => set({ isOpen: true, defaultValues }),
  onClose: () => set({ isOpen: false, defaultValues: undefined }),
}));