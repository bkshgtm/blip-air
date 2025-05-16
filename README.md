<div align="center">
  <img src="client/public/favicon/logo.png" alt="BlipAir Logo" width="180" />
  <h1>BlipAir</h1>
  <p><strong>Seamless peer-to-peer file transfers directly in your browser</strong></p>
  
  <p>
    <a href="https://www.blipair.com">Live Demo</a> •
    <a href="#features">Features</a> •
    <a href="#how-it-works">How It Works</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#development">Development</a> •
    <a href="#deployment">Deployment</a>
  </p>
  
  <img src="https://img.shields.io/badge/platform-web-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/version-1.0.0-orange" alt="Version" />
</div>

---

## Overview

BlipAir is a modern web application that enables direct peer-to-peer file transfers between devices without uploading files to a server. Using WebRTC technology, BlipAir creates secure, encrypted connections directly between browsers, allowing for fast and private file sharing.


  <img width="1512" alt="Image" src="https://github.com/user-attachments/assets/abb9ce33-edde-4006-84f3-8547e4539ac7" />


## Features

- **Direct Peer-to-Peer Transfers**: Send files directly to other devices without server intermediaries
- **No Size Limits**: Transfer files of any size, limited only by your device's memory
- **Cross-Platform Compatibility**: Works on desktop and mobile browsers (except safari on iOS for now)
- **Automatic Peer Discovery**: Easily find other devices on the same network
- **Robust Transfer Management**:
  - Pause and resume transfers
  - Real-time progress tracking
  - Automatic recovery from connection issues
- **Enhanced Security**: End-to-end encrypted transfers using WebRTC
- **Elegant UI**: Responsive design with dark and light themes

<div align="center">
  <img width="1512" alt="Image" src="https://github.com/user-attachments/assets/f1b73912-8594-46d3-9e0b-9ea1ed5c43e0" />
</div>

## How It Works

BlipAir uses a combination of modern web technologies to enable seamless file transfers:

1. **WebRTC** for direct peer-to-peer connections and data channels
2. **WebSockets** for signaling and peer discovery
3. **Blob API** for efficient file handling
4. **File System Access API** (where available) for improved file saving

<div align="center">
  <img width="1512" alt="Image" src="https://github.com/user-attachments/assets/46eac4d4-ca27-4d70-a775-1835f0b0a2f5" />
</div>

### Technical Architecture

BlipAir consists of two main components:

- **Client**: React application with TypeScript, Vite, and TailwindCSS
- **Signaling Server**: Express.js server for WebSocket connections and peer discovery

The signaling server only facilitates the initial connection between peers. Once connected, all file transfers occur directly between browsers without passing through any server.

div align="center">
  <img width="1512" alt="Image" src="https://github.com/user-attachments/assets/739ade51-1701-460c-b862-1c62ce9860f4" />
</div>

## Getting Started

### Using BlipAir

1. **Open BlipAir** in your browser: [https://blipair.vercel.app](https://blipair.vercel.app)
2. **Allow necessary permissions** when prompted
3. **Select a peer** from the discovered devices list
4. **Choose files** to send by clicking the upload area or dragging and dropping
5. **Monitor transfer progress** in real-time
6. **Download completed files** when transfers finish

<div align="center">
  <img width="1512" alt="Image" src="https://github.com/user-attachments/assets/2dab14c6-99b0-4e59-8115-6c8860354109" />
</div>

### Tips for Best Performance

- **Use modern browsers** like Chrome, Firefox, Edge, or Safari for optimal compatibility
- **Connect to the same network** as your peer for faster discovery and transfers
- **Keep the app open** during transfers to prevent interruptions
- **For large files**, ensure both devices have sufficient storage and memory

## Development

### Prerequisites

- Node.js 18.x or higher
- npm or pnpm

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/blip-air.git
   cd blip-air
   ```

2. Install dependencies:

   ```bash
   # Install client dependencies
   cd client
   npm install

   # Install server dependencies
   cd ../server
   npm install
   ```

3. Set up environment variables:

   - Create `.env.local` in the client directory based on `.env` template
   - Configure STUN/TURN servers for WebRTC connections

4. Generate SSL certificates for local development:

   ```bash
   cd client
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes

   cd ../server
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

### Running Locally

1. Start the server:

   ```bash
   cd server
   npm run dev
   ```

2. Start the client:

   ```bash
   cd client
   npm run dev
   ```

3. Open your browser at `https://localhost:5173`

<div align="center">
  <img src="screenshots/mobile-view.png" alt="Mobile View" width="40%" />
</div>

## Deployment

### Client Deployment

The client is configured for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy using the default settings

### Server Deployment

The signaling server is configured for deployment on Fly.io:

1. Install the Fly CLI
2. Authenticate with Fly.io
3. Deploy using:
   ```bash
   cd server
   fly deploy
   ```

## Technical Details

### Key Technologies

- **Frontend**: React, TypeScript, Vite, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, Socket.io
- **Communication**: WebRTC, WebSockets
- **Deployment**: Vercel (client), Fly.io (server)

### Architecture Highlights

- **Zustand** for state management
- **WebRTC** data channels for peer-to-peer communication
- **Chunked file transfers** for handling large files
- **Adaptive network detection** for optimal connection establishment
- **Progressive enhancement** with File System Access API where available

<div align="center">
  <img src="screenshots/completed-transfer.png" alt="Completed Transfer" width="80%" />
</div>

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [WebRTC](https://webrtc.org/) for the peer-to-peer technology
- [Socket.io](https://socket.io/) for the signaling mechanism
- [React](https://reactjs.org/) for the UI framework
- [Vite](https://vitejs.dev/) for the build tool
- [TailwindCSS](https://tailwindcss.com/) for styling
- [Framer Motion](https://www.framer.com/motion/) for animations

---

<div align="center">
  <p>Made by <a href="https://github.com/bkshgtm">Bikash Gautam</a></p>
</div>
