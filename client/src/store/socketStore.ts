import { create } from "zustand"
import { io, type Socket } from "socket.io-client"
import { useWebRTCStore } from "./webrtcStore"
import { useSettingsStore } from "./settingsStore"

// Enhanced logging for network diagnostics
const VERBOSE_LOGGING = true

function logNetworkDiagnostics(message: string, data?: any) {
  if (VERBOSE_LOGGING) {
    console.log(`[NetworkDiagnostics] ${message}`, data ? data : "")
  }
}

// Device detection for special handling - more aggressive approach
const isIOSSafari = () => {
  const ua = navigator.userAgent
  // More aggressive iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  // More permissive Safari detection
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  const isIOSSafari = isIOS && isSafari

  console.log(`[SocketStore] iOS Safari detection:`, {
    userAgent: ua,
    isIOS,
    isSafari,
    isIOSSafari,
  })

  return isIOSSafari
}

// General Safari detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

// Check URL for force flags (for testing)
const urlParams = new URLSearchParams(window.location.search)
const forceIOSSafari = urlParams.get("force-ios-safari") === "true"

// Create device info with more details
const deviceInfo = {
  isIOSSafari: forceIOSSafari || isIOSSafari(),
  isSafari: forceIOSSafari || isSafari,
  isMobile: forceIOSSafari || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  userAgent: navigator.userAgent,
  forceIOSSafari: forceIOSSafari,
}

// Log device detection details
console.log(`[SocketStore] Device detection:`, deviceInfo)
if (forceIOSSafari) {
  console.log(`[SocketStore] ⚠️ iOS Safari mode FORCED via URL parameter`)
}

const BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001"
const SERVER_URL = BASE_URL.replace(/^http/, "ws").replace(/^https/, "wss")

console.log(`[SocketStore] Connecting to WebSocket URL: ${SERVER_URL}`)
logNetworkDiagnostics("Environment configuration", {
  baseUrl: BASE_URL,
  serverUrl: SERVER_URL,
  viteEnv: import.meta.env.MODE,
  // Use MODE to determine development vs production
  isDevelopment: import.meta.env.MODE === "development",
  isProduction: import.meta.env.MODE === "production",
})

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
  isPrivateNetwork?: boolean // Whether the client is on a private network (for backward compatibility)
  subnet?: string // The subnet the client is on (for backward compatibility)
  networkId?: string // Network identifier (from new implementation)
  peerCount: number // Number of peers on the same network
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

      // Log detailed connection information
      logNetworkDiagnostics("Socket connected", {
        socketId: newSocket.id,
        transport: newSocket.io.engine.transport.name,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent,
      })

      // Log network interfaces if available
      try {
        // Network Information API might not be available in all browsers
        // @ts-ignore - Using optional chaining to safely access
        const connection = navigator?.connection
        if (connection) {
          logNetworkDiagnostics("Network connection info", {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
          })
        } else {
          logNetworkDiagnostics("Network Information API not available")
        }
      } catch (error) {
        logNetworkDiagnostics("Error accessing network information", { error })
      }

      // Send device info to server for special handling
      console.log("[SocketStore] Sending device info to server:", deviceInfo)
      newSocket.emit("device-info", deviceInfo)

      // Set up Safari-specific ping to keep connection alive
      if (deviceInfo.isIOSSafari || deviceInfo.isSafari) {
        console.log("[SocketStore] Setting up Safari ping interval to keep connection alive")
        const pingInterval = setInterval(() => {
          if (newSocket.connected) {
            console.log("[SocketStore] Sending ping to keep Safari connection alive")
            newSocket.emit("ping")
          } else {
            clearInterval(pingInterval)
          }
        }, 30000) // Send ping every 30 seconds

        // Clear interval on disconnect
        newSocket.on("disconnect", () => {
          clearInterval(pingInterval)
        })
      }

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
      logNetworkDiagnostics("Session created", { sessionData })

      // Handle both old format (string sessionId) and new format (object with id, isPrivateNetwork, subnet)
      if (typeof sessionData === "string") {
        // Old format - just a session ID string
        console.log(`[SocketStore] Received session ID in old format (string)`)
        logNetworkDiagnostics("Session format", { type: "legacy-string" })
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
        // New format - object with id, isPrivateNetwork, networkId/subnet
        console.log(`[SocketStore] Received session data in new format (object)`)
        logNetworkDiagnostics("Session format", {
          type: "object",
          isPrivateNetwork: sessionData.isPrivateNetwork,
          networkId: sessionData.networkId,
          subnet: sessionData.subnet,
        })

        // Create network info object with required fields
        const networkInfo: NetworkInfo = {
          peerCount: 0,
          totalOnlineUsers: 1, // Just this client for now
        }

        // Add optional fields if they exist
        if (sessionData.isPrivateNetwork !== undefined) {
          networkInfo.isPrivateNetwork = sessionData.isPrivateNetwork
        }

        if (sessionData.networkId !== undefined) {
          networkInfo.networkId = sessionData.networkId
        } else if (sessionData.subnet !== undefined) {
          // Backward compatibility
          networkInfo.subnet = sessionData.subnet
        }

        set({
          sessionId: sessionData.id,
          networkInfo,
        })
      } else {
        console.error(`[SocketStore] Unexpected data format for session-created:`, sessionData)
        logNetworkDiagnostics("Session format error", { receivedData: sessionData })
      }
    })

    newSocket.on("peers-updated", (data: any) => {
      // Handle both old format (array of peers) and new format (object with peers and networkInfo)
      let peerList: PeerInfo[] = []
      let networkInfo: NetworkInfo | null = null

      logNetworkDiagnostics("Peers updated event received", {
        dataType: Array.isArray(data) ? "array" : typeof data,
        hasNetworkInfo: data && typeof data === "object" && data.networkInfo ? true : false,
      })

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
        logNetworkDiagnostics("Peers update format error", { receivedData: data })
        return
      }

      const currentId = newSocket.id
      const updated = peerList.map((peer) => (peer.id === currentId ? { ...peer, name: sessionName } : peer))

      // Log peer and network information for debugging
      if (networkInfo) {
        console.log(`[SocketStore] Network info:`, networkInfo)
        logNetworkDiagnostics("Network information", networkInfo)
      }

      if (updated.length > 0) {
        console.log(
          `[SocketStore] Received ${updated.length} peers:`,
          updated.map((p) => ({ id: p.id, name: p.name, subnet: p.subnet })),
        )
        logNetworkDiagnostics("Peers found", {
          count: updated.length,
          peers: updated.map((p) => ({ id: p.id, name: p.name })),
        })
      } else {
        console.log(`[SocketStore] No peers received from server`)
        logNetworkDiagnostics("No peers found", { groupId: networkInfo?.subnet })

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
