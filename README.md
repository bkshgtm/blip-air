# P2P File Sharing App

A secure, peer-to-peer file sharing application that works exclusively on local area networks (LAN). This application features AES-GCM encryption, a modern glassmorphic UI built with Chakra UI and Framer Motion, and direct device-to-device file transfers using WebRTC.

## Features

- **LAN-only file sharing**: Works only between devices on the same WiFi network
- **End-to-end encryption**: AES-GCM encryption via Web Crypto API
- **Modern UI**: Glassmorphic design with Chakra UI and Framer Motion animations
- **No file size limits**: Transfer files of any size directly between devices
- **Resume support**: Pause and resume file transfers
- **Transfer statistics**: View progress, speed, and ETA in real-time
- **QR code pairing**: Easily connect devices using QR codes
- **No server storage**: Files are transferred directly between devices with no server storage

## Tech Stack

### Frontend
- React 19.0.0
- Vite 6.3.5
- TypeScript
- Chakra UI 3.17.0
- Framer Motion 12.10.5
- Zustand 5.0.4
- React Router DOM 7.6.0
- qrcode.react

### Backend
- Node.js
- Express 5.1.0
- Socket.IO 4.8.1

## Setup

### Prerequisites
- Node.js (LTS version)
- npm or yarn

### Installation

1. Clone the repository
\`\`\`bash
git clone https://github.com/yourusername/p2p-file-sharing.git
cd p2p-file-sharing
\`\`\`

2. Install dependencies for both client and server
\`\`\`bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
\`\`\`

3. Create environment files
\`\`\`bash
# In the root directory
cp .env.example .env
\`\`\`

## Running the Application

### Development Mode

1. Start the server
\`\`\`bash
# In the server directory
npm run dev
\`\`\`

2. Start the client
\`\`\`bash
# In the client directory
npm run dev
\`\`\`

3. Open your browser and navigate to `http://localhost:5173`

### Production Build

1. Build the client
\`\`\`bash
# In the client directory
npm run build
\`\`\`

2. Start the server in production mode
\`\`\`bash
# In the server directory
npm start
\`\`\`

## Deployment

### Frontend (Vercel)

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Configure the build settings:
   - Build Command: `cd client && npm install && npm run build`
   - Output Directory: `client/dist`
   - Install Command: `npm install`

### Backend (Fly.io or Render)

#### Fly.io
1. Install the Fly CLI
2. Navigate to the server directory
3. Run `fly launch` to create a new app
4. Deploy with `fly deploy`

#### Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the build settings:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`

## Environment Variables

### Server
- `PORT`: The port on which the server will run (default: 3001)

### Client
- `VITE_SERVER_URL`: The URL of the server (e.g., http://localhost:3001 for development)

## Security Considerations

- This application is designed for use on trusted local networks only
- All file transfers are encrypted using AES-GCM
- No files or metadata are stored on any server
- Sessions expire after 5 minutes of inactivity

## License

MIT
