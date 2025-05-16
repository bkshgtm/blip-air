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

// Helper function to check if an IP is in a private range
function isPrivateIP(ip) {
  // Handle IPv4 addresses
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);

    // Check for private IPv4 ranges
    // 10.0.0.0 - 10.255.255.255
    if (parts[0] === 10) return true;

    // 172.16.0.0 - 172.31.255.255
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 169.254.0.0 - 169.254.255.255 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // Localhost
    if (parts[0] === 127) return true;

    return false;
  }

  // Handle IPv6 addresses
  if (ip.includes(":")) {
    // Convert to lowercase for comparison
    const ipLower = ip.toLowerCase();

    // Check for IPv6 localhost
    if (ipLower === "::1" || ipLower === "0:0:0:0:0:0:0:1") return true;

    // Check for IPv6 unique local addresses (fc00::/7)
    if (ipLower.startsWith("fc") || ipLower.startsWith("fd")) return true;

    // Check for IPv6 link-local addresses (fe80::/10)
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

// Helper function to extract subnet from IP address
function getSubnet(ip) {
  // Handle IPv4 addresses
  if (ip.includes(".")) {
    const parts = ip.split(".");

    // Different subnet masks based on private IP ranges
    if (parts[0] === "10") {
      // 10.0.0.0/8 - Use first two octets
      return parts.slice(0, 2).join(".");
    } else if (
      parts[0] === "172" &&
      parseInt(parts[1]) >= 16 &&
      parseInt(parts[1]) <= 31
    ) {
      // 172.16.0.0/12 - Use first two octets
      return parts.slice(0, 2).join(".");
    } else if (parts[0] === "192" && parts[1] === "168") {
      // 192.168.0.0/16 - Use first three octets
      return parts.slice(0, 3).join(".");
    } else if (parts[0] === "169" && parts[1] === "254") {
      // 169.254.0.0/16 (link-local) - Use first three octets
      return parts.slice(0, 3).join(".");
    } else {
      // Default for other IPv4 addresses
      return parts.slice(0, 3).join(".");
    }
  }

  // Handle IPv6 addresses
  else if (ip.includes(":")) {
    // For IPv6, use the first 4 segments as the subnet
    // This is a simplification but should work for most cases
    const normalizedIP = ip.toLowerCase();

    // Handle special cases
    if (normalizedIP === "::1" || normalizedIP === "0:0:0:0:0:0:0:1") {
      return "localhost-ipv6";
    }

    // Split by : and take first 4 segments
    const parts = normalizedIP.split(":");
    return parts.slice(0, 4).join(":");
  }

  // Fallback
  return "unknown";
}

// Group ID for clients that can't be properly grouped by subnet
const FALLBACK_GROUP_ID = "global-fallback-group";

io.on("connection", (socket) => {
  // Get client's IP address
  let clientIp =
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.headers["x-real-ip"] ||
    socket.conn.remoteAddress ||
    socket.handshake.address;

  // If x-forwarded-for contains multiple IPs, take the first one (client IP)
  if (clientIp && clientIp.includes(",")) {
    clientIp = clientIp.split(",")[0].trim();
  }

  // Remove IPv6 prefix if present (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
  if (clientIp && clientIp.includes("::ffff:") && clientIp.includes(".")) {
    clientIp = clientIp.replace(/^.*:/, "");
  }

  // Extract subnet
  const subnet = getSubnet(clientIp);
  const isPrivate = isPrivateIP(clientIp);

  // Determine group ID - use subnet for private IPs, fallback for public IPs
  const groupId = isPrivate ? subnet : FALLBACK_GROUP_ID;

  console.log(
    `Client connected: ${socket.id} from IP: ${clientIp}, Subnet: ${subnet}, Private: ${isPrivate}, Group: ${groupId}`
  );

  const sessionId = uuidv4();
  const sessionName = `User-${sessionId.substring(0, 4)}`;

  // Store session info with IP and subnet
  sessions.set(sessionId, {
    socketId: socket.id,
    name: sessionName,
    ip: clientIp,
    subnet: subnet,
    groupId: groupId,
    isPrivateNetwork: isPrivate,
    connectionTime: Date.now(),
    peers: [],
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
    subnet: subnet,
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

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Clean up session and subnet group
    const session = Array.from(sessions.entries()).find(
      ([_, s]) => s.socketId === socket.id
    );

    if (session) {
      const [id, sessionData] = session;

      // Remove from subnet group
      if (sessionData.subnet && subnetGroups.has(sessionData.subnet)) {
        subnetGroups.get(sessionData.subnet).delete(id);

        // Clean up empty subnet groups
        if (subnetGroups.get(sessionData.subnet).size === 0) {
          subnetGroups.delete(sessionData.subnet);
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
            subnet: peerSession.subnet, // Include subnet for debugging
            isPrivateNetwork: peerSession.isPrivateNetwork,
            // Include connection time to help identify peers that connected around the same time
            // This can be useful for users to identify which peer is which
            connectionTime: peerSession.connectionTime,
          };
        });
    }

    // Send peers and network status information
    io.to(session.socketId).emit("peers-updated", {
      peers: peersInSameGroup,
      networkInfo: {
        isPrivateNetwork: session.isPrivateNetwork,
        subnet: session.subnet,
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
