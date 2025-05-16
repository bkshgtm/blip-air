# BlipAir Peer Discovery System Documentation

This document describes the current peer discovery system in BlipAir and provides guidance on using the new diagnostic tools to troubleshoot any issues.

## Current Implementation

BlipAir uses a subnet-based peer discovery system that works as follows:

1. **IP Detection**: When a client connects to the server, the server extracts the client's IP address from various headers.
2. **Private Network Detection**: The server checks if the IP is in a private range (10.x.x.x, 172.16-31.x.x, 192.168.x.x, etc.).
3. **Subnet Extraction**: For private IPs, the server extracts a subnet identifier (e.g., 192.168.1 from 192.168.1.5).
4. **Group Assignment**: Clients are grouped by subnet if on a private network, or placed in a fallback group if on a public network.
5. **Peer Discovery**: Clients only see other clients in the same group.

## Diagnostic Tools

We've added enhanced logging and diagnostic tools to help troubleshoot peer discovery issues:

### Server-Side Diagnostics

1. **Enhanced Logging**: The server now logs detailed information about client connections, IP detection, and peer grouping.
2. **Peer Discovery Status Endpoint**: A new endpoint at `/peer-discovery-status` provides real-time information about active sessions and groups.

### Client-Side Diagnostics

1. **Network Diagnostics**: The client now logs detailed information about its connection to the server, network status, and peer discovery.
2. **Browser Console**: Check the browser console for logs prefixed with `[NetworkDiagnostics]` for detailed information.

## Troubleshooting Guide

### Common Issues

1. **"No peers found" message**:

   - Check if all devices are on the same network
   - Verify that the server is correctly identifying client IPs
   - Look for subnet extraction in server logs

2. **Peers not showing up when deployed to Vercel**:

   - Check server logs to see how clients are being grouped
   - Verify that clients have the same public IP or are in the same subnet group

3. **Random users appearing in peer list**:
   - Check if clients are being incorrectly grouped together
   - Verify subnet extraction in server logs

### How to Use Diagnostic Tools

#### Server Logs

1. When running the server locally, check the terminal for logs prefixed with `[PeerDiscovery]`.
2. When deployed to fly.io, use `flyctl logs` to view server logs.

Example log entries:

```
[PeerDiscovery] Client connected {"socketId":"abc123","clientIp":"192.168.1.5","subnet":"192.168.1","isPrivateNetwork":true,"groupId":"192.168.1"}
[PeerDiscovery] Updating peers {"totalSessions":2,"totalGroups":1,"groups":["192.168.1"]}
```

#### Peer Discovery Status Endpoint

1. Access `/peer-discovery-status` on your server (e.g., https://blipair-webrtc.fly.dev/peer-discovery-status)
2. This provides a JSON response with information about active sessions and groups:

```json
{
  "totalSessions": 2,
  "totalGroups": 1,
  "groups": [
    {
      "groupId": "192.168.1",
      "peerCount": 2
    }
  ],
  "environment": {
    "isFlyIo": true,
    "isLocalDev": false,
    "isProd": true
  }
}
```

#### Client Console Logs

1. Open browser developer tools (F12 or right-click > Inspect)
2. Go to the Console tab
3. Look for logs prefixed with `[NetworkDiagnostics]`

Example log entries:

```
[NetworkDiagnostics] Environment configuration {"baseUrl":"https://blipair-webrtc.fly.dev","serverUrl":"wss://blipair-webrtc.fly.dev","viteEnv":"production","isDevelopment":false,"isProduction":true}
[NetworkDiagnostics] Socket connected {"socketId":"abc123","transport":"websocket","hostname":"blipair.vercel.app","protocol":"https:","userAgent":"..."}
[NetworkDiagnostics] Session created {"sessionData":{"id":"def456","isPrivateNetwork":false,"subnet":"203.0.113"}}
```

## Testing Peer Discovery

To test if peer discovery is working correctly:

1. **Local Development**:

   - Run the server locally: `cd server && npm run dev`
   - Run the client locally: `cd client && npm run dev`
   - Open the app on multiple devices on the same network
   - Check server logs and client console for diagnostic information

2. **Production**:
   - Deploy the server to fly.io: `cd server && flyctl deploy`
   - Deploy the client to Vercel
   - Access the app on multiple devices
   - Check fly.io logs and client console for diagnostic information

## Current Behavior in Different Environments

### Local Development

- When running both client and server locally, peer discovery works well for devices on the same network.
- The server correctly identifies local IP addresses and groups peers by subnet.

### Production (Client on Vercel, Server on fly.io)

- The server sees clients' public IP addresses, not their local network IPs.
- Clients on the same network (behind the same router) will have the same public IP and should be grouped together.
- The "Not on a private network" warning may appear even for clients on private networks, because the server sees their public IP.

## Conclusion

The current peer discovery system works well for most use cases, especially in local development. The enhanced logging and diagnostic tools should help identify and troubleshoot any issues that arise.

If you encounter persistent issues with peer discovery, please check the logs and diagnostic information as described above, and consider the environment-specific behaviors noted in this document.
