import { create } from "zustand";

interface UiState {
  isQrCodeModalOpen: boolean;
  openQrCodeModal: () => void;
  closeQrCodeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isQrCodeModalOpen: false,
  openQrCodeModal: () => set({ isQrCodeModalOpen: true }),
  closeQrCodeModal: () => set({ isQrCodeModalOpen: false }),
}));
