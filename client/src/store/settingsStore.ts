import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useSocketStore } from "./socketStore"

interface SettingsState {
  sessionName: string
  pin: string
  darkMode: boolean
  chunkSize: number
  useCompression: boolean

  setSessionName: (name: string) => void
  setPin: (pin: string) => void
  toggleDarkMode: () => void
  setDarkMode: (isDark: boolean) => void
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

      setSessionName: (name: string) => {
        set({ sessionName: name })

        const socket = useSocketStore.getState().socket
        if (socket && socket.connected) {
          socket.emit("set-name", name)
          console.log(`[Settings] Emitted set-name event with new name: ${name}`)
        }
      },
      setPin: (pin: string) => set({ pin }),
      toggleDarkMode: () => {
        set((state) => {
          const newDarkMode = !state.darkMode

          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", newDarkMode)
          }
          return { darkMode: newDarkMode }
        })
      },
      setDarkMode: (isDark: boolean) => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", isDark)
        }
        set({ darkMode: isDark })
      },
      setChunkSize: (size: number) => set({ chunkSize: size }),
      toggleCompression: () => set((state) => ({ useCompression: !state.useCompression })),
    }),
    {
      name: "BlipAirSettings",
    },
  ),
)
