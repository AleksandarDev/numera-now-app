import { create } from "zustand";

type NewTransactionState = {
  doubleEntry: boolean;
  isOpen: boolean;
  onOpen: (doubleEntry?: boolean) => void;
  onClose: () => void;
};

export const useNewTransaction = create<NewTransactionState>((set) => ({
  isOpen: false,
  doubleEntry: false,
  onOpen: (doubleEntry) => set({ isOpen: true, doubleEntry: Boolean(doubleEntry) }),
  onClose: () => set({ isOpen: false }),
}));