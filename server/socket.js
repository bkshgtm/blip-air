// This file is imported by server.js and contains the Socket.IO logic
// It's separated for better organization

import { v4 as uuidv4 } from "uuid"

// Store active sessions
const sessions = new Map()

export function setupSocketIO(io) {
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
    updatePeers(io)

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
      updatePeers(io)
    })
  })
}

// Helper function to find a socket ID by session ID
function findSocketIdBySessionId(sessionId) {
  const session = sessions.get(sessionId)
  return session ? session.socketId : null
}

// Helper function to update all clients with the current peer list
function updatePeers(io) {
  // For each session, send the list of all other sessions
  for (const [sessionId, session] of sessions.entries()) {
    const peers = Array.from(sessions.keys()).filter((id) => id !== sessionId)
    io.to(session.socketId).emit("peers-updated", peers)
  }
}
