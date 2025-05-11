import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useWebRTCStore } from "./webrtcStore"; // Import the WebRTC store

// Define the server URL - in production this would be your deployed backend
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://192.168.1.76:3001"

interface SocketState {
  socket: Socket | null
  isConnected: boolean
  sessionId: string | null
  peers: string[]
  initSocket: () => void
  disconnectSocket: () => void
  setSessionId: (id: string) => void
  setPeers: (peers: string[]) => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  sessionId: null,
  peers: [],

  initSocket: () => {
    const { socket } = get()

    // If socket already exists, don't create a new one
    if (socket) return

    // Create new socket connection
    const newSocket = io(SERVER_URL, {
      transports: ["websocket"],
      autoConnect: true,
      withCredentials: true,
    })

    // Set up event listeners
    newSocket.on("connect", () => {
      console.log("Connected to signaling server")
      set({ isConnected: true })
    })

    newSocket.on("disconnect", () => {
      console.log("Disconnected from signaling server")
      set({ isConnected: false })
    })

    newSocket.on("session-created", (sessionId: string) => {
      console.log("Session created:", sessionId)
      set({ sessionId })
    })

    newSocket.on("peers-updated", (peers: string[]) => {
      console.log("Peers updated:", peers);
      set({ peers });
    });

    // Setup global handlers for WebRTC signaling
    newSocket.on("relay-offer", ({ offer, from }) => {
      console.log(`[SocketStore] Received relay-offer from ${from}`);
      useWebRTCStore.getState().handleRelayOffer(offer, from);
    });

    newSocket.on("relay-answer", ({ answer, from }) => {
      console.log(`[SocketStore] Received relay-answer from ${from}`);
      useWebRTCStore.getState().handleRelayAnswer(answer, from);
    });

    newSocket.on("relay-ice-candidate", ({ candidate, from }) => {
      console.log(`[SocketStore] Received relay-ice-candidate from ${from}`);
      useWebRTCStore.getState().handleRelayIceCandidate(candidate, from);
    });

    // Store the socket in state
    set({ socket: newSocket });
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

  setPeers: (peers: string[]) => {
    set({ peers })
  },
}))
