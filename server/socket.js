import { v4 as uuidv4 } from "uuid";

const sessions = new Map();

export function setupSocketIO(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    const sessionId = uuidv4();

    sessions.set(sessionId, {
      socketId: socket.id,
      peers: [],
    });

    socket.emit("session-created", sessionId);

    updatePeers(io);

    socket.on("relay-offer", ({ offer, peerId }) => {
      const peerSocketId = findSocketIdBySessionId(peerId);

      if (peerSocketId) {
        io.to(peerSocketId).emit("relay-offer", {
          offer,
          from: sessionId,
        });
      }
    });

    socket.on("relay-answer", ({ answer, peerId }) => {
      const peerSocketId = findSocketIdBySessionId(peerId);

      if (peerSocketId) {
        io.to(peerSocketId).emit("relay-answer", {
          answer,
          from: sessionId,
        });
      }
    });

    socket.on("relay-ice-candidate", ({ candidate, peerId }) => {
      const peerSocketId = findSocketIdBySessionId(peerId);

      if (peerSocketId) {
        io.to(peerSocketId).emit("relay-ice-candidate", {
          candidate,
          from: sessionId,
        });
      }
    });

    socket.on("set-name", (name) => {
      console.log(`Client ${socket.id} set name to: ${name}`);

      // Find the session for this socket and update the name
      for (const [id, session] of sessions.entries()) {
        if (session.socketId === socket.id) {
          session.name = name;
          console.log(`Session ${id} name set to ${name}`);

          // Update peers list for all connected clients
          updatePeers(io);
          break;
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      for (const [id, session] of sessions.entries()) {
        if (session.socketId === socket.id) {
          sessions.delete(id);
          break;
        }
      }

      updatePeers(io);
    });
  });
}

function findSocketIdBySessionId(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.socketId : null;
}

function updatePeers(io) {
  for (const [sessionId, session] of sessions.entries()) {
    const peers = Array.from(sessions.keys()).filter((id) => id !== sessionId);
    io.to(session.socketId).emit("peers-updated", peers);
  }
}
