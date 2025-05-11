import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import { v4 as uuidv4 } from "uuid"

const app = express()
const server = http.createServer(app)

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend domain
    methods: ["GET", "POST"],
  },
})

// Enable CORS for Express
app.use(cors())

// Store active sessions
const sessions = new Map()

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Generate a unique session ID for this client
  const sessionId = uuidv4()

  // Store the session
  sessions.set(sessionId, {
    socketId: socket.id,
    peers: [],
  })

  // Send the session ID to the client
  socket.emit("session-created", sessionId)

  // Update all clients with the new peer list
  updatePeers()

  // Handle relay messages for WebRTC signaling
  socket.on("relay-offer", ({ offer, peerId }) => {
    // Find the socket ID for the peer
    const peerSocketId = findSocketIdBySessionId(peerId)

    if (peerSocketId) {
      // Relay the offer to the peer
      io.to(peerSocketId).emit("relay-offer", {
        offer,
        from: sessionId,
      })
    }
  })

  socket.on("relay-answer", ({ answer, peerId }) => {
    // Find the socket ID for the peer
    const peerSocketId = findSocketIdBySessionId(peerId)

    if (peerSocketId) {
      // Relay the answer to the peer
      io.to(peerSocketId).emit("relay-answer", {
        answer,
        from: sessionId,
      })
    }
  })

  socket.on("relay-ice-candidate", ({ candidate, peerId }) => {
    // Find the socket ID for the peer
    const peerSocketId = findSocketIdBySessionId(peerId)

    if (peerSocketId) {
      // Relay the ICE candidate to the peer
      io.to(peerSocketId).emit("relay-ice-candidate", {
        candidate,
        from: sessionId,
      })
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)

    // Find and remove the session
    for (const [id, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        sessions.delete(id)
        break
      }
    }

    // Update all clients with the new peer list
    updatePeers()
  })
})

// Helper function to find a socket ID by session ID
function findSocketIdBySessionId(sessionId) {
  const session = sessions.get(sessionId)
  return session ? session.socketId : null
}

// Helper function to update all clients with the current peer list
function updatePeers() {
  // For each session, send the list of all other sessions
  for (const [sessionId, session] of sessions.entries()) {
    const peers = Array.from(sessions.keys()).filter((id) => id !== sessionId)
    io.to(session.socketId).emit("peers-updated", peers)
  }
}

// Start the server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
