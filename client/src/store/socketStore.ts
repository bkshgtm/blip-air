import { create } from "zustand"
import { io, type Socket } from "socket.io-client"
import { useWebRTCStore } from "./webrtcStore"
import { useSettingsStore } from "./settingsStore"

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001"
const SERVER_URL = BASE_URL.replace(/^http/, "ws").replace(/^https/, "wss")

console.log(`[SocketStore] Connecting to WebSocket URL: ${SERVER_URL}`)

const CONNECTION_TIMEOUT = 10000

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
      autoConnect: false,
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: CONNECTION_TIMEOUT,
    })

    const timeoutId = setTimeout(() => {
      if (!newSocket.connected) {
        console.error("WebSocket connection timed out.")
        newSocket.disconnect()
      }
    }, CONNECTION_TIMEOUT)

    newSocket.connect()

    newSocket.on("connect", () => {
      clearTimeout(timeoutId)
      console.log("✅ Connected to signaling server")
      set({ isConnected: true })
      if (sessionName) {
        newSocket.emit("set-name", sessionName)
      }
    })

    newSocket.on("connect_error", (err) => {
      console.error("Connection error:", err.message)
      clearTimeout(timeoutId)
      setTimeout(() => {
        console.log("Attempting to reconnect...")
        newSocket.connect()
      }, 2000)
    })

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from signaling server")
      set({ isConnected: false })
    })

    newSocket.on("session-created", (sessionId: string) => {
      console.log("Session ID received:", sessionId)
      set({ sessionId })
    })

    newSocket.on("peers-updated", (peerList: PeerInfo[]) => {
      const currentId = newSocket.id
      const updated = peerList.map((peer) => (peer.id === currentId ? { ...peer, name: sessionName } : peer))
      set({ peers: updated })
    })

    newSocket.on("relay-offer", ({ offer, from }) => {
      useWebRTCStore.getState().handleRelayOffer(offer, from)
    })

    newSocket.on("relay-answer", ({ answer, from }) => {
      useWebRTCStore.getState().handleRelayAnswer(answer, from)
    })

    newSocket.on("relay-ice-candidate", ({ candidate, from }) => {
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

  setSessionId: (id: string) => set({ sessionId: id }),

  setPeers: (peers: PeerInfo[]) => set({ peers }),
}))
