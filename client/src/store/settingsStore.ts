import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsState {
  sessionName: string
  pin: string
  darkMode: boolean
  chunkSize: number
  useCompression: boolean

  setSessionName: (name: string) => void
  setPin: (pin: string) => void
  toggleDarkMode: () => void
  setChunkSize: (size: number) => void
  toggleCompression: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sessionName: `User-${Math.floor(Math.random() * 10000)}`,
      pin: Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0"),
      darkMode: true,
      chunkSize: 64 * 1024,
      useCompression: false,

      setSessionName: (name: string) => set({ sessionName: name }),
      setPin: (pin: string) => set({ pin }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setChunkSize: (size: number) => set({ chunkSize: size }),
      toggleCompression: () => set((state) => ({ useCompression: !state.useCompression })),
    }),
    {
      name: "p2p-app-settings",
    },
  ),
)
