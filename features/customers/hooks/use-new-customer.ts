import { create } from "zustand";

type NewCustomerState = {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
};

export const useNewCustomer = create<NewCustomerState>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));
