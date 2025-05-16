import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const VERBOSE_LOGGING = true;

function logPeerDiscovery(message, data) {
  if (VERBOSE_LOGGING) {
    console.log(`[PeerDiscovery] ${message}`, data ? JSON.stringify(data) : "");
  }
}

function getDeploymentEnvironment() {
  const isFlyIo = process.env.FLY_APP_NAME !== undefined;

  const isLocalDev = process.env.NODE_ENV !== "production";

  logPeerDiscovery(`Deployment environment:`, {
    environment: isFlyIo
      ? "fly.io"
      : isLocalDev
      ? "local development"
      : "unknown production",
    nodeEnv: process.env.NODE_ENV,
  });

  return {
    isFlyIo,
    isLocalDev,
    isProd: process.env.NODE_ENV === "production",
  };
}

const app = express();

const env = getDeploymentEnvironment();
logPeerDiscovery("Server starting up", { environment: env });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

if (IS_PROD) {
  server = http.createServer(
    {
      insecureHTTPParser: false,
      keepAlive: true,
    },
    app
  );
} else {
  const keyPath = path.resolve(__dirname, "key.pem");
  const certPath = path.resolve(__dirname, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(" SSL certs missing. Generate key.pem and cert.pem.");
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
    origin: IS_PROD
      ? [
          "https://your-client-domain.com",
          "https://blipair.vercel.app",
          "https://*.vercel.app",
          "https://localhost:5173",
          "https://127.0.0.1:5173",
          "https://192.168.1.76:5173",
        ]
      : "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true, // Allow Engine.IO 3 compatibility
});

app.use(
  cors({
    origin: IS_PROD
      ? [
          "https://your-client-domain.com",
          "https://blipair.vercel.app",
          "https://*.vercel.app",
          "https://localhost:5173",
          "https://127.0.0.1:5173",
          "https://192.168.1.76:5173",
        ]
      : [
          "https://localhost:5173",
          "https://127.0.0.1:5173",
          "https://192.168.1.76:5173",
        ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (req, res) => {
  res.status(200).send("✅ BlipAir signaling server is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.get("/peer-discovery-status", (req, res) => {
  const stats = {
    totalSessions: sessions.size,
    totalGroups: subnetGroups.size,
    groups: Array.from(subnetGroups.entries()).map(([groupId, sessionIds]) => ({
      groupId,
      peerCount: sessionIds.size,
    })),
    environment: getDeploymentEnvironment(),
  };

  res.status(200).json(stats);
});

if (IS_PROD) {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  // Handle client-side routing
  app.get(/^\/(?!api|health|socket\.io).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

// === Signaling logic ===
const sessions = new Map();
const subnetGroups = new Map();

function getNetworkId(ip) {
  logPeerDiscovery(`Extracting network ID from IP: ${ip}`);

  if (!ip || typeof ip !== "string") {
    logPeerDiscovery(`Invalid IP address: ${ip}, using fallback group`);
    return "unknown-network";
  }

  if (ip.includes(".")) {
    const parts = ip.split(".");

    if (parts.length >= 3) {
      const networkId = parts.slice(0, 3).join(".");
      logPeerDiscovery(`Extracted network ID ${networkId} from IPv4 ${ip}`);
      return networkId;
    }
    return ip;
  }

  if (ip.includes(":")) {
    const normalizedIP = ip.toLowerCase();

    if (normalizedIP === "::1" || normalizedIP === "0:0:0:0:0:0:0:1") {
      return "localhost-ipv6";
    }

    const parts = normalizedIP.split(":");
    if (parts.length >= 4) {
      const networkId = parts.slice(0, 4).join(":");
      logPeerDiscovery(`Extracted network ID ${networkId} from IPv6 ${ip}`);
      return networkId;
    }

    return normalizedIP;
  }

  logPeerDiscovery(`Unrecognized IP format: ${ip}, using as-is`);
  return ip;
}

function isPrivateIP(ip) {
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);

    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 127) return true;

    return false;
  }

  if (ip.includes(":")) {
    const ipLower = ip.toLowerCase();

    if (ipLower === "::1" || ipLower === "0:0:0:0:0:0:0:1") return true;

    if (ipLower.startsWith("fc") || ipLower.startsWith("fd")) return true;

    if (
      ipLower.startsWith("fe8") ||
      ipLower.startsWith("fe9") ||
      ipLower.startsWith("fea") ||
      ipLower.startsWith("feb")
    )
      return true;

    return false;
  }

  return false;
}

io.on("connection", (socket) => {
  let clientIp =
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.headers["x-real-ip"] ||
    socket.conn.remoteAddress ||
    socket.handshake.address;

  logPeerDiscovery("Raw client IP detection", {
    xForwardedFor: socket.handshake.headers["x-forwarded-for"],
    xRealIp: socket.handshake.headers["x-real-ip"],
    remoteAddress: socket.conn.remoteAddress,
    handshakeAddress: socket.handshake.address,
  });

  if (clientIp && clientIp.includes(",")) {
    const originalIp = clientIp;
    clientIp = clientIp.split(",")[0].trim();
    logPeerDiscovery(`Extracted first IP from comma-separated list`, {
      original: originalIp,
      extracted: clientIp,
    });
  }

  if (clientIp && clientIp.includes("::ffff:") && clientIp.includes(".")) {
    const originalIp = clientIp;
    clientIp = clientIp.replace(/^.*:/, "");
    logPeerDiscovery(`Removed IPv6 prefix`, {
      original: originalIp,
      cleaned: clientIp,
    });
  }

  const networkId = getNetworkId(clientIp);

  const isPrivate = isPrivateIP(clientIp);

  const groupId = networkId;

  logPeerDiscovery(`Client connected`, {
    socketId: socket.id,
    clientIp: clientIp,
    networkId: networkId,
    isPrivateNetwork: isPrivate,
    groupId: groupId,
  });

  console.log(
    `Client connected: ${socket.id} from IP: ${clientIp}, NetworkID: ${networkId}, Private: ${isPrivate}, Group: ${groupId}`
  );

  const sessionId = uuidv4();
  const sessionName = `User-${sessionId.substring(0, 4)}`;

  sessions.set(sessionId, {
    socketId: socket.id,
    name: sessionName,
    ip: clientIp,
    networkId: networkId,
    groupId: groupId,
    isPrivateNetwork: isPrivate,
    connectionTime: Date.now(),
    peers: [],
    deviceInfo: null,
    isIOSSafari: false,
  });

  if (!subnetGroups.has(groupId)) {
    subnetGroups.set(groupId, new Set());
  }
  subnetGroups.get(groupId).add(sessionId);

  socket.emit("session-created", {
    id: sessionId,
    isPrivateNetwork: isPrivate,
    networkId: networkId,
    subnet: networkId,
  });

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

  socket.on("device-info", (deviceInfo) => {
    const session = Array.from(sessions.entries()).find(
      ([_, s]) => s.socketId === socket.id
    );

    if (session) {
      const [id, sessionData] = session;

      sessionData.deviceInfo = deviceInfo;

      if (deviceInfo.isIOSSafari) {
        console.log(
          `iOS Safari detected for session ${id}. Applying special handling.`
        );
        logPeerDiscovery(`iOS Safari detected`, { sessionId: id, deviceInfo });

        sessionData.isIOSSafari = true;

        updatePeers();
      }
    }
  });

  socket.on("ping", () => {
    socket.emit("pong");
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    const session = Array.from(sessions.entries()).find(
      ([_, s]) => s.socketId === socket.id
    );

    if (session) {
      const [id, sessionData] = session;

      if (sessionData.groupId && subnetGroups.has(sessionData.groupId)) {
        subnetGroups.get(sessionData.groupId).delete(id);

        if (subnetGroups.get(sessionData.groupId).size === 0) {
          subnetGroups.delete(sessionData.groupId);
        }
      }

      sessions.delete(id);
    }

    updatePeers();
  });
});

function findSocketIdBySessionId(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.socketId : null;
}

function updatePeers() {
  logPeerDiscovery(`Updating peers`, {
    totalSessions: sessions.size,
    totalGroups: subnetGroups.size,
    groups: Array.from(subnetGroups.keys()),
  });

  const mobileSessions = new Map();
  const iosSafariSessions = new Map();
  const allPrivateNetworkSessions = new Map();

  for (const [id, session] of sessions.entries()) {
    if (
      session.deviceInfo &&
      (session.deviceInfo.isIOSSafari || session.isIOSSafari)
    ) {
      iosSafariSessions.set(id, session);
      console.log(`[PeerDiscovery] Identified iOS Safari session: ${id}`);
    }

    if (session.deviceInfo && session.deviceInfo.isMobile) {
      mobileSessions.set(id, session);
    }

    if (session.isPrivateNetwork) {
      allPrivateNetworkSessions.set(id, session);
    }
  }

  console.log(
    `[PeerDiscovery] Found ${iosSafariSessions.size} iOS Safari sessions, ${mobileSessions.size} mobile sessions, and ${allPrivateNetworkSessions.size} private network sessions`
  );

  for (const [sessionId, session] of sessions.entries()) {
    let peersToInclude = new Map();

    if (session.groupId && subnetGroups.has(session.groupId)) {
      const sessionIdsInGroup = Array.from(subnetGroups.get(session.groupId));
      for (const peerId of sessionIdsInGroup) {
        if (peerId !== sessionId) {
          peersToInclude.set(peerId, sessions.get(peerId));
        }
      }
    }

    const isIOSSafari = iosSafariSessions.has(sessionId);

    if (isIOSSafari) {
      console.log(
        `[PeerDiscovery] iOS Safari special handling: Adding all private network peers to ${sessionId}`
      );

      for (const [peerId, peerSession] of allPrivateNetworkSessions.entries()) {
        if (peerId !== sessionId && !peersToInclude.has(peerId)) {
          peersToInclude.set(peerId, peerSession);
          console.log(
            `[PeerDiscovery] Added peer ${peerId} to iOS Safari session ${sessionId}`
          );
        }
      }
    } else if (session.isPrivateNetwork) {
      for (const [
        iosSafariId,
        iosSafariSession,
      ] of iosSafariSessions.entries()) {
        if (iosSafariId !== sessionId && !peersToInclude.has(iosSafariId)) {
          peersToInclude.set(iosSafariId, iosSafariSession);
          console.log(
            `[PeerDiscovery] Added iOS Safari peer ${iosSafariId} to session ${sessionId}`
          );
        }
      }
    }

    const peersInSameGroup = Array.from(peersToInclude.entries()).map(
      ([peerId, peerSession]) => ({
        id: peerId,
        name: peerSession.name,
        networkId: peerSession.networkId,
        subnet: peerSession.networkId,
        isPrivateNetwork: peerSession.isPrivateNetwork,
        connectionTime: peerSession.connectionTime,

        isMobile: peerSession.deviceInfo?.isMobile || false,
        isIOSSafari:
          peerSession.deviceInfo?.isIOSSafari ||
          peerSession.isIOSSafari ||
          false,
      })
    );

    console.log(
      `[PeerDiscovery] Sending ${peersInSameGroup.length} peers to client ${sessionId} (${session.name})`
    );
    logPeerDiscovery(`Sending peers to client`, {
      sessionId: sessionId,
      clientName: session.name,
      groupId: session.groupId,
      peerCount: peersInSameGroup.length,
      isPrivateNetwork: session.isPrivateNetwork,
      isIOSSafari: isIOSSafari,
      peerIds: peersInSameGroup.map((p) => p.id),
    });

    io.to(session.socketId).emit("peers-updated", {
      peers: peersInSameGroup,
      networkInfo: {
        isPrivateNetwork: session.isPrivateNetwork,
        networkId: session.networkId,
        subnet: session.networkId,
        peerCount: peersInSameGroup.length,
        totalOnlineUsers: sessions.size,
      },
    });
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
