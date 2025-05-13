import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.resolve(__dirname, "key.pem");
const certPath = path.resolve(__dirname, "cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(
    "SSL certificate files not found. Please ensure key.pem and cert.pem are in the server directory."
  );
  console.error(
    "You can copy them from the 'client' directory if you generated them there for Vite."
  );
  process.exit(1);
}

const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const server = https.createServer(options, app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const sessions = new Map();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  const sessionId = uuidv4();

  const sessionName = `User-${sessionId.substring(0, 4)}`;

  sessions.set(sessionId, {
    socketId: socket.id,
    name: sessionName,
    peers: [],
  });

  socket.emit("session-created", sessionId);

  updatePeers();

  socket.on("set-name", (name) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.name = name;
      console.log(`Session ${sessionId} name set to ${name}`);
      updatePeers();
    }
  });

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

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    for (const [id, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        sessions.delete(id);
        break;
      }
    }

    updatePeers();
  });
});

function findSocketIdBySessionId(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.socketId : null;
}

function updatePeers() {
  for (const [sessionId, session] of sessions.entries()) {
    const peers = Array.from(sessions.entries())
      .filter(([id]) => id !== sessionId)
      .map(([id, peerSession]) => ({ id, name: peerSession.name }));

    io.to(session.socketId).emit("peers-updated", peers);
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
