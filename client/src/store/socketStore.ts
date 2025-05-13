import { create } from "zustand"
import { io, type Socket } from "socket.io-client"
import { useWebRTCStore } from "./webrtcStore" // Import the WebRTC store
import { useSettingsStore } from "./settingsStore"

const VITE_SERVER_URL_CONFIG = import.meta.env.VITE_SERVER_URL || "192.168.1.76:3001"
const VITE_SERVER_URL_BASE = VITE_SERVER_URL_CONFIG.replace(/^(wss?:\/\/)?/, "")

let SERVER_URL: string

if (typeof window !== "undefined") {
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://"
  SERVER_URL = `${protocol}${VITE_SERVER_URL_BASE}`
  console.log(`[SocketStore] Determined SERVER_URL: ${SERVER_URL}`)
} else {
  SERVER_URL = `ws://${VITE_SERVER_URL_BASE}`
  console.log(`[SocketStore] Fallback SERVER_URL (non-browser): ${SERVER_URL}`)
}

interface PeerInfo {
  id: string
  name: string
}

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  sessionId: string | null
  peers: PeerInfo[]
  initSocket: () => void
  disconnectSocket: () => void
  setSessionId: (id: string) => void
  setPeers: (peers: PeerInfo[]) => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  sessionId: null,
  peers: [],

  initSocket: () => {
    const { sessionName } = useSettingsStore.getState()
    const { socket } = get()

    if (socket) return

    const newSocket = io(SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
      withCredentials: true,
    })

    newSocket.on("connect", () => {
      console.log("Connected to signaling server")
      set({ isConnected: true })
      if (sessionName) {
        newSocket.emit("set-name", sessionName)
      }
    })

    newSocket.on("disconnect", () => {
      console.log("Disconnected from signaling server")
      set({ isConnected: false })
    })

    newSocket.on("session-created", (sessionId: string) => {
      console.log("Session created:", sessionId)
      set({ sessionId })
    })

    newSocket.on("peers-updated", (peersData: Array<{ id: string; name: string }>) => {
      console.log("Peers updated:", peersData)
      const currentUserId = newSocket.id
      const updatedPeers = peersData.map((peer) => {
        if (peer.id === currentUserId) {
          return { ...peer, name: sessionName }
        }
        return peer
      })
      set({ peers: updatedPeers })
    })

    newSocket.on("relay-offer", ({ offer, from }) => {
      console.log(`[SocketStore] Received relay-offer from ${from}`)
      useWebRTCStore.getState().handleRelayOffer(offer, from)
    })

    newSocket.on("relay-answer", ({ answer, from }) => {
      console.log(`[SocketStore] Received relay-answer from ${from}`)
      useWebRTCStore.getState().handleRelayAnswer(answer, from)
    })

    newSocket.on("relay-ice-candidate", ({ candidate, from }) => {
      console.log(`[SocketStore] Received relay-ice-candidate from ${from}`)
      useWebRTCStore.getState().handleRelayIceCandidate(candidate, from)
    })

    set({ socket: newSocket })
  },

  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  setSessionId: (id: string) => {
    set({ sessionId: id })
  },

  setPeers: (peers: PeerInfo[]) => {
    set({ peers })
  },
}))
