import express from "express";
import http from "http";
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

// === Server setup ===
let server;
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD) {
  // Fly handles HTTPS — use plain HTTP
  server = http.createServer(app);
} else {
  // Dev mode — use self-signed HTTPS
  const keyPath = path.resolve(__dirname, "key.pem");
  const certPath = path.resolve(__dirname, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error("❌ SSL certs missing. Generate key.pem and cert.pem.");
    process.exit(1);
  }

  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  server = https.createServer(options, app);
}

// === Socket.IO setup ===
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

// === Health check routes ===
app.get("/", (req, res) => {
  res.status(200).send("✅ BlipAir signaling server is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// === Signaling logic ===
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
      io.to(peerSocketId).emit("relay-offer", { offer, from: sessionId });
    }
  });

  socket.on("relay-answer", ({ answer, peerId }) => {
    const peerSocketId = findSocketIdBySessionId(peerId);
    if (peerSocketId) {
      io.to(peerSocketId).emit("relay-answer", { answer, from: sessionId });
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

// === Start server ===
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
