import { create } from 'zustand';

type YearClosingWizardState = {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
};

export const useYearClosingWizard = create<YearClosingWizardState>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));
