import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useWebRTCStore } from "./webrtcStore"; // Import the WebRTC store

// Define the server URL - in production this would be your deployed backend
let VITE_SERVER_URL_CONFIG = import.meta.env.VITE_SERVER_URL || "192.168.1.76:3001";

// Remove any existing protocol from the VITE_SERVER_URL_CONFIG
const VITE_SERVER_URL_BASE = VITE_SERVER_URL_CONFIG.replace(/^(wss?:\/\/)?/, "");

let SERVER_URL: string;

if (typeof window !== 'undefined') {
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  SERVER_URL = `${protocol}${VITE_SERVER_URL_BASE}`;
  console.log(`[SocketStore] Determined SERVER_URL: ${SERVER_URL}`);
} else {
  // Fallback for non-browser environments
  SERVER_URL = `ws://${VITE_SERVER_URL_BASE}`; // Default to ws for non-browser
  console.log(`[SocketStore] Fallback SERVER_URL (non-browser): ${SERVER_URL}`);
}


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
