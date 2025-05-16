import { create } from "zustand"
import { io, type Socket } from "socket.io-client"
import { useWebRTCStore } from "./webrtcStore"
import { useSettingsStore } from "./settingsStore"

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001"
const SERVER_URL = BASE_URL.replace(/^http/, "ws").replace(/^https/, "wss")

console.log(`[SocketStore] Connecting to WebSocket URL: ${SERVER_URL}`)

const CONNECTION_TIMEOUT = 10000

// Flag to determine if we're running in development or production
const IS_DEV =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.includes(".local")

console.log(`[SocketStore] Running in ${IS_DEV ? "development" : "production"} mode`)

interface PeerInfo {
  id: string
  name: string
  subnet?: string // Subnet information from server
  isPrivateNetwork?: boolean // Whether the peer is on a private network
  connectionTime?: number // When the peer connected
}

interface NetworkInfo {
  isPrivateNetwork: boolean // Whether the client is on a private network
  subnet: string // The subnet the client is on
  peerCount: number // Number of peers on the same subnet
  totalOnlineUsers: number // Total number of users online
}

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  sessionId: string | null
  peers: PeerInfo[]
  networkInfo: NetworkInfo | null // Network information from server
  localNetworkOnly: boolean // Flag to filter peers by local network (kept for API compatibility)
  initSocket: () => void
  disconnectSocket: () => void
  setSessionId: (id: string) => void
  setPeers: (peers: PeerInfo[]) => void
  setLocalNetworkOnly: (value: boolean) => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  sessionId: null,
  peers: [],
  networkInfo: null,
  localNetworkOnly: true, // Default to local network only (kept for API compatibility)

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

    newSocket.on("session-created", (sessionData: any) => {
      console.log("Session data received:", sessionData)

      // Handle both old format (string sessionId) and new format (object with id, isPrivateNetwork, subnet)
      if (typeof sessionData === "string") {
        // Old format - just a session ID string
        console.log(`[SocketStore] Received session ID in old format (string)`)
        set({
          sessionId: sessionData,
          networkInfo: {
            isPrivateNetwork: IS_DEV, // Assume private network in dev mode
            subnet: "unknown",
            peerCount: 0,
            totalOnlineUsers: 1, // Just this client for now
          },
        })
      } else if (sessionData && typeof sessionData === "object" && sessionData.id) {
        // New format - object with id, isPrivateNetwork, subnet
        console.log(`[SocketStore] Received session data in new format (object)`)
        set({
          sessionId: sessionData.id,
          networkInfo: {
            isPrivateNetwork: sessionData.isPrivateNetwork !== undefined ? sessionData.isPrivateNetwork : IS_DEV,
            subnet: sessionData.subnet || "unknown",
            peerCount: 0,
            totalOnlineUsers: 1, // Just this client for now
          },
        })
      } else {
        console.error(`[SocketStore] Unexpected data format for session-created:`, sessionData)
      }
    })

    newSocket.on("peers-updated", (data: any) => {
      // Handle both old format (array of peers) and new format (object with peers and networkInfo)
      let peerList: PeerInfo[] = []
      let networkInfo: NetworkInfo | null = null

      if (Array.isArray(data)) {
        // Old format - just an array of peers
        console.log(`[SocketStore] Received peers in old format (array)`)
        peerList = data

        // Create default network info
        networkInfo = {
          isPrivateNetwork: IS_DEV, // Assume private network in dev mode
          subnet: "unknown",
          peerCount: peerList.length,
          totalOnlineUsers: peerList.length + 1, // +1 for this client
        }
      } else if (data && typeof data === "object") {
        // New format - object with peers and networkInfo
        console.log(`[SocketStore] Received peers in new format (object with peers and networkInfo)`)
        peerList = data.peers || []
        networkInfo = data.networkInfo || null
      } else {
        console.error(`[SocketStore] Unexpected data format for peers-updated:`, data)
        return
      }

      const currentId = newSocket.id
      const updated = peerList.map((peer) => (peer.id === currentId ? { ...peer, name: sessionName } : peer))

      // Log peer and network information for debugging
      if (networkInfo) {
        console.log(`[SocketStore] Network info:`, networkInfo)
      }

      if (updated.length > 0) {
        console.log(
          `[SocketStore] Received ${updated.length} peers:`,
          updated.map((p) => ({ id: p.id, name: p.name, subnet: p.subnet })),
        )
      } else {
        console.log(`[SocketStore] No peers received from server`)

        // If on a private network but no peers, log a helpful message
        if (networkInfo && networkInfo.isPrivateNetwork) {
          console.log(
            `[SocketStore] You are on a private network (${networkInfo.subnet}) but no peers were found. Make sure other devices are on the same WiFi network.`,
          )
        } else if (networkInfo) {
          console.log(`[SocketStore] You are not on a private network. Local peer discovery may not work.`)
        }
      }

      // Update state with peers and network info
      set({
        peers: updated,
        networkInfo,
      })
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

  // This function is kept for API compatibility but no longer needed
  // since the server now handles filtering by subnet
  setLocalNetworkOnly: (value: boolean) => {
    set({ localNetworkOnly: value })
    console.log(`[SocketStore] Local network only mode ${value ? "enabled" : "disabled"} (handled by server)`)
  },
}))
