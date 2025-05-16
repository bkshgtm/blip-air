import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

// Enhanced logging for peer discovery
const VERBOSE_LOGGING = true; // Can be toggled with an environment variable later

// Add this function for controlled logging
function logPeerDiscovery(message, data) {
  if (VERBOSE_LOGGING) {
    console.log(`[PeerDiscovery] ${message}`, data ? JSON.stringify(data) : "");
  }
}

// Environment detection
function getDeploymentEnvironment() {
  // Check for fly.io specific environment variables
  const isFlyIo = process.env.FLY_APP_NAME !== undefined;

  // Check for local development indicators
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

// Call this early in server startup
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
          "https://*.vercel.app", // Allow all subdomains on vercel.app
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

// More specific CORS for Express
app.use(
  cors({
    origin: IS_PROD
      ? [
          "https://your-client-domain.com",
          "https://blipair.vercel.app",
          "https://*.vercel.app", // Allow all subdomains on vercel.app
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

// === Health check routes ===
app.get("/", (req, res) => {
  res.status(200).send("✅ BlipAir signaling server is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Detailed peer discovery status endpoint
app.get("/peer-discovery-status", (req, res) => {
  // Gather stats without changing behavior
  const stats = {
    totalSessions: sessions.size,
    totalGroups: subnetGroups.size,
    groups: Array.from(subnetGroups.entries()).map(([groupId, sessionIds]) => ({
      groupId,
      peerCount: sessionIds.size,
      // Don't include actual session IDs for privacy
    })),
    environment: getDeploymentEnvironment(),
  };

  res.status(200).json(stats);
});

// Only serve static files in production
if (IS_PROD) {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  // Handle client-side routing
  app.get(/^\/(?!api|health|socket\.io).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

// === Signaling logic ===
const sessions = new Map();
const subnetGroups = new Map(); // Map to group clients by subnet

/**
 * Network ID extraction - Following Snapdrop's approach
 *
 * This function extracts a network identifier from an IP address.
 * For IPv4, it uses the first three octets (e.g., 192.168.1.x -> 192.168.1)
 * This groups devices on the same subnet together.
 */
function getNetworkId(ip) {
  logPeerDiscovery(`Extracting network ID from IP: ${ip}`);

  // Handle empty or invalid IPs
  if (!ip || typeof ip !== "string") {
    logPeerDiscovery(`Invalid IP address: ${ip}, using fallback group`);
    return "unknown-network";
  }

  // For IPv4 addresses
  if (ip.includes(".")) {
    const parts = ip.split(".");

    // Use first three octets for all IPv4 addresses
    // This works for both private (192.168.1.x) and public IPs
    if (parts.length >= 3) {
      const networkId = parts.slice(0, 3).join(".");
      logPeerDiscovery(`Extracted network ID ${networkId} from IPv4 ${ip}`);
      return networkId;
    }
    return ip; // Fallback to full IP if we can't extract parts
  }

  // For IPv6 addresses
  if (ip.includes(":")) {
    const normalizedIP = ip.toLowerCase();

    // Handle localhost
    if (normalizedIP === "::1" || normalizedIP === "0:0:0:0:0:0:0:1") {
      return "localhost-ipv6";
    }

    // For other IPv6 addresses, extract the first 4 segments
    const parts = normalizedIP.split(":");
    if (parts.length >= 4) {
      const networkId = parts.slice(0, 4).join(":");
      logPeerDiscovery(`Extracted network ID ${networkId} from IPv6 ${ip}`);
      return networkId;
    }

    // Fallback to full IP
    return normalizedIP;
  }

  // Fallback for any other format
  logPeerDiscovery(`Unrecognized IP format: ${ip}, using as-is`);
  return ip;
}

/**
 * Check if an IP is in a private range
 * This is used for informational purposes only, not for grouping
 */
function isPrivateIP(ip) {
  // Handle IPv4 addresses
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);

    // Check for private IPv4 ranges
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local)
    if (parts[0] === 127) return true; // Localhost

    return false;
  }

  // Handle IPv6 addresses
  if (ip.includes(":")) {
    const ipLower = ip.toLowerCase();

    // IPv6 localhost
    if (ipLower === "::1" || ipLower === "0:0:0:0:0:0:0:1") return true;

    // IPv6 unique local addresses (fc00::/7)
    if (ipLower.startsWith("fc") || ipLower.startsWith("fd")) return true;

    // IPv6 link-local addresses (fe80::/10)
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
  // Get client's IP address
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

  // If x-forwarded-for contains multiple IPs, take the first one (client IP)
  if (clientIp && clientIp.includes(",")) {
    const originalIp = clientIp;
    clientIp = clientIp.split(",")[0].trim();
    logPeerDiscovery(`Extracted first IP from comma-separated list`, {
      original: originalIp,
      extracted: clientIp,
    });
  }

  // Remove IPv6 prefix if present (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
  if (clientIp && clientIp.includes("::ffff:") && clientIp.includes(".")) {
    const originalIp = clientIp;
    clientIp = clientIp.replace(/^.*:/, "");
    logPeerDiscovery(`Removed IPv6 prefix`, {
      original: originalIp,
      cleaned: clientIp,
    });
  }

  // Extract network ID - this is the key to proper peer grouping
  const networkId = getNetworkId(clientIp);

  // Check if on private network (for informational purposes only)
  const isPrivate = isPrivateIP(clientIp);

  // Always use the network ID as the group ID
  // This ensures devices on the same network are grouped together
  // regardless of whether they're on a private or public network
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

  // Store session info
  sessions.set(sessionId, {
    socketId: socket.id,
    name: sessionName,
    ip: clientIp,
    networkId: networkId,
    groupId: groupId,
    isPrivateNetwork: isPrivate,
    connectionTime: Date.now(),
    peers: [],
    deviceInfo: null, // Will be populated when device-info is received
    isIOSSafari: false, // Will be set to true for iOS Safari devices
  });

  // Add to subnet group
  if (!subnetGroups.has(groupId)) {
    subnetGroups.set(groupId, new Set());
  }
  subnetGroups.get(groupId).add(sessionId);

  // Send additional info to client
  socket.emit("session-created", {
    id: sessionId,
    isPrivateNetwork: isPrivate,
    networkId: networkId,
    subnet: networkId, // Keep subnet for backward compatibility
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

  // Handle device info for special handling of iOS Safari
  socket.on("device-info", (deviceInfo) => {
    const session = Array.from(sessions.entries()).find(
      ([_, s]) => s.socketId === socket.id
    );

    if (session) {
      const [id, sessionData] = session;

      // Store device info
      sessionData.deviceInfo = deviceInfo;

      // Special handling for iOS Safari
      if (deviceInfo.isIOSSafari) {
        console.log(
          `iOS Safari detected for session ${id}. Applying special handling.`
        );
        logPeerDiscovery(`iOS Safari detected`, { sessionId: id, deviceInfo });

        sessionData.isIOSSafari = true;

        // Force update peers to apply iOS Safari special handling
        updatePeers();
      }
    }
  });

  // Handle ping from Safari clients to keep connection alive
  socket.on("ping", () => {
    socket.emit("pong");
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Clean up session and subnet group
    const session = Array.from(sessions.entries()).find(
      ([_, s]) => s.socketId === socket.id
    );

    if (session) {
      const [id, sessionData] = session;

      // Remove from network group
      if (sessionData.groupId && subnetGroups.has(sessionData.groupId)) {
        subnetGroups.get(sessionData.groupId).delete(id);

        // Clean up empty network groups
        if (subnetGroups.get(sessionData.groupId).size === 0) {
          subnetGroups.delete(sessionData.groupId);
        }
      }

      // Remove session
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

  // First, create a map of all iOS Safari sessions for special handling
  const iosSafariSessions = new Map();
  for (const [id, session] of sessions.entries()) {
    if (session.isIOSSafari) {
      iosSafariSessions.set(id, session);
    }
  }

  // Log iOS Safari sessions if any are found
  if (iosSafariSessions.size > 0) {
    logPeerDiscovery(
      `Found ${iosSafariSessions.size} iOS Safari sessions for special handling`,
      {
        sessionIds: Array.from(iosSafariSessions.keys()),
      }
    );
  }

  for (const [sessionId, session] of sessions.entries()) {
    // Get peers only from the same group (subnet or fallback)
    const groupId = session.groupId;
    let peersInSameGroup = [];

    if (groupId && subnetGroups.has(groupId)) {
      // Get all session IDs in the same group
      const sessionIdsInGroup = Array.from(subnetGroups.get(groupId));

      // Filter out the current session and map to peer info
      peersInSameGroup = sessionIdsInGroup
        .filter((id) => id !== sessionId)
        .map((id) => {
          const peerSession = sessions.get(id);
          return {
            id,
            name: peerSession.name,
            networkId: peerSession.networkId, // Include networkId for debugging
            subnet: peerSession.networkId, // Keep subnet for backward compatibility
            isPrivateNetwork: peerSession.isPrivateNetwork,
            // Include connection time to help identify peers that connected around the same time
            // This can be useful for users to identify which peer is which
            connectionTime: peerSession.connectionTime,
          };
        });
    }

    // Special handling for iOS Safari devices
    if (session.isIOSSafari) {
      // For iOS Safari, include all peers on private networks
      // This ensures iOS Safari can see all peers regardless of network ID
      logPeerDiscovery(`Applying iOS Safari special handling for ${sessionId}`);

      // Find all peers on private networks that aren't already included
      for (const [peerId, peerSession] of sessions.entries()) {
        // Skip self and already included peers
        if (
          peerId === sessionId ||
          peersInSameGroup.some((p) => p.id === peerId)
        ) {
          continue;
        }

        // Include peers on private networks
        if (peerSession.isPrivateNetwork) {
          peersInSameGroup.push({
            id: peerId,
            name: peerSession.name,
            networkId: peerSession.networkId,
            subnet: peerSession.networkId,
            isPrivateNetwork: peerSession.isPrivateNetwork,
            connectionTime: peerSession.connectionTime,
          });

          logPeerDiscovery(
            `Added peer ${peerId} to iOS Safari session ${sessionId} via special handling`
          );
        }
      }
    }

    // For non-iOS Safari devices, add iOS Safari peers to their peer list
    // This ensures other devices can see iOS Safari peers
    if (
      !session.isIOSSafari &&
      session.isPrivateNetwork &&
      iosSafariSessions.size > 0
    ) {
      for (const [
        iosSafariId,
        iosSafariSession,
      ] of iosSafariSessions.entries()) {
        // Skip if this iOS Safari peer is already in the list
        if (peersInSameGroup.some((p) => p.id === iosSafariId)) {
          continue;
        }

        // Add the iOS Safari peer to this device's peer list
        peersInSameGroup.push({
          id: iosSafariId,
          name: iosSafariSession.name,
          networkId: iosSafariSession.networkId,
          subnet: iosSafariSession.networkId,
          isPrivateNetwork: iosSafariSession.isPrivateNetwork,
          connectionTime: iosSafariSession.connectionTime,
        });

        logPeerDiscovery(
          `Added iOS Safari peer ${iosSafariId} to session ${sessionId}`
        );
      }
    }

    logPeerDiscovery(`Sending peers to client`, {
      sessionId: sessionId,
      clientName: session.name,
      groupId: groupId,
      peerCount: peersInSameGroup.length,
      isPrivateNetwork: session.isPrivateNetwork,
      isIOSSafari: session.isIOSSafari,
    });

    // Send peers and network status information
    io.to(session.socketId).emit("peers-updated", {
      peers: peersInSameGroup,
      networkInfo: {
        isPrivateNetwork: session.isPrivateNetwork,
        networkId: session.networkId,
        subnet: session.networkId, // Keep subnet for backward compatibility
        peerCount: peersInSameGroup.length,
        totalOnlineUsers: sessions.size,
      },
    });
  }
}

// === Start server ===
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
