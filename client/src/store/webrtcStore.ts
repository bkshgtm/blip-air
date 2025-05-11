import { create } from "zustand"
import { useSocketStore } from "./socketStore"
import { useSettingsStore } from "./settingsStore"
import { encryptData, decryptData } from "../lib/encryption"

interface PeerConnection {
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  sessionId: string
}

interface FileTransfer {
  fileId: string
  fileName: string
  fileSize: number
  fileType: string
  progress: number
  speed: number
  eta: number
  status: "pending" | "transferring" | "paused" | "completed" | "error"
  direction: "incoming" | "outgoing"
  peerId: string
  chunks: {
    total: number
    received: number
    size: number
  }
  startTime?: number
  error?: string
  _notified?: boolean
}

interface WebRTCState {
  peerConnections: Map<string, PeerConnection>
  transfers: FileTransfer[]
  selectedFiles: File[]

  // Methods for managing connections
  createPeerConnection: (peerId: string) => Promise<void>
  closePeerConnection: (peerId: string) => void

  // Methods for file transfers
  setSelectedFiles: (files: File[]) => void
  sendFiles: (peerId: string) => Promise<void>
  pauseTransfer: (transferId: string) => void
  resumeTransfer: (transferId: string) => void
  cancelTransfer: (transferId: string) => void
  acceptTransfer: (transferId: string) => void
  rejectTransfer: (transferId: string) => void

  // Helper methods
  updateTransferProgress: (transferId: string, progress: number, speed: number, eta: number) => void
  addTransfer: (transfer: Omit<FileTransfer, "progress" | "speed" | "eta" | "status">) => string
  updateTransferStatus: (transferId: string, status: FileTransfer["status"], error?: string) => void

  // Methods for handling relayed signaling messages
  handleRelayOffer: (offer: RTCSessionDescriptionInit, fromPeerId: string) => Promise<void>
  handleRelayAnswer: (answer: RTCSessionDescriptionInit, fromPeerId: string) => Promise<void>
  handleRelayIceCandidate: (candidate: RTCIceCandidateInit, fromPeerId: string) => Promise<void>
}

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  peerConnections: new Map(),
  transfers: [],
  selectedFiles: [],

  createPeerConnection: async (peerId: string) => {
    console.log(`[WebRTC] createPeerConnection called for peerId: ${peerId}`);
    const socket = useSocketStore.getState().socket
    if (!socket) {
      console.error("[WebRTC] No socket available in createPeerConnection");
      return;
    }

    const existingConnection = get().peerConnections.get(peerId);
    if (existingConnection) {
      console.log(`[WebRTC] Existing connection found for peer ${peerId}. State: ${existingConnection.connection.signalingState}, DataChannel: ${existingConnection.dataChannel?.readyState}`);
      // If data channel is open, we might not need to recreate.
      // For now, we'll proceed to ensure event listeners are attached for this attempt.
      // Consider more sophisticated reuse logic later if needed.
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for peer ${peerId}`);
    // Create a new RTCPeerConnection
    const peerConnection = new RTCPeerConnection({
      iceServers: [], // No STUN/TURN servers as we're LAN only
    })

    // Create a data channel for file transfer
    const dataChannel = peerConnection.createDataChannel("fileTransfer", {
      ordered: true,
    })

    // Set up data channel event handlers
    dataChannel.onopen = () => {
      console.log(`[WebRTC] Data channel opened with peer ${peerId}`);
    }

    dataChannel.onclose = () => {
      console.log(`[WebRTC] Data channel closed with peer ${peerId}`);
    }

    dataChannel.onmessage = async (event) => {
      console.log(`[WebRTC] Data channel message received from ${peerId}`);
      // Handle incoming messages (file chunks, control messages)
      try {
        const message = JSON.parse(event.data)

        if (message.type === "file-offer") {
          // Handle file offer
          const { fileId, fileName, fileSize, fileType } = message.data

          // Add new transfer to the state
          get().addTransfer({
            fileId,
            fileName,
            fileSize,
            fileType,
            direction: "incoming",
            peerId,
            chunks: {
              total: Math.ceil(fileSize / useSettingsStore.getState().chunkSize),
              received: 0,
              size: useSettingsStore.getState().chunkSize,
            },
          })

          // Send acknowledgment
          dataChannel.send(
            JSON.stringify({
              type: "file-offer-ack",
              data: { fileId },
            }),
          )
        } else if (message.type === "file-chunk") {
          // Handle file chunk
          const { fileId, chunkIndex, totalChunks, chunk, encryptionDetails } = message.data

          // Decrypt the chunk
          const decryptedChunk = await decryptData(chunk, encryptionDetails.key, encryptionDetails.iv)

          // Process the chunk (in a real implementation, you'd assemble the file)
          console.log(`[WebRTC] Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId} from peer ${peerId}`);

          // Update transfer progress
          const transfers = get().transfers
          const transferIndex = transfers.findIndex((t) => t.fileId === fileId)

          if (transferIndex !== -1) {
            const transfer = transfers[transferIndex]
            const newProgress = (chunkIndex + 1) / totalChunks

            // Calculate speed and ETA
            const now = Date.now()
            const elapsedTime = transfer.startTime ? (now - transfer.startTime) / 1000 : 0
            const speed = elapsedTime > 0 ? (transfer.fileSize * newProgress) / elapsedTime : 0
            const remainingBytes = transfer.fileSize * (1 - newProgress)
            const eta = speed > 0 ? remainingBytes / speed : 0

            get().updateTransferProgress(fileId, newProgress, speed, eta)

            // Update chunks received
            const updatedTransfers = [...transfers]
            updatedTransfers[transferIndex].chunks.received = chunkIndex + 1
            set({ transfers: updatedTransfers })

            // If all chunks received, mark as completed
            if (chunkIndex + 1 === totalChunks) {
              get().updateTransferStatus(fileId, "completed")
            }
          }

          // Send acknowledgment
          dataChannel.send(
            JSON.stringify({
              type: "chunk-ack",
              data: { fileId, chunkIndex },
            }),
          )
        } else if (message.type === "transfer-control") {
          // Handle transfer control messages (pause, resume, cancel)
          const { fileId, action } = message.data

          if (action === "pause") {
            get().updateTransferStatus(fileId, "paused")
          } else if (action === "resume") {
            get().updateTransferStatus(fileId, "transferring")
          } else if (action === "cancel") {
            get().updateTransferStatus(fileId, "error", "Transfer cancelled by peer")
          }
        }
      } catch (error) {
        console.error("Error processing message:", error)
      }
    }

    // Set up ICE candidate event
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Generated ICE candidate for peer ${peerId}:`, event.candidate);
        // Send the ICE candidate to the peer via signaling server
        socket.emit("relay-ice-candidate", {
          candidate: event.candidate,
          peerId, // Target peer for this candidate
        });
      }
    };

    // Handle incoming data channels (primarily for the peer being connected to)
    peerConnection.ondatachannel = (event) => {
      console.log(`[WebRTC] Incoming data channel event from peer ${peerId}`);
      const incomingDataChannel = event.channel;
      console.log(`[WebRTC] Incoming data channel "${incomingDataChannel.label}" received.`);

      // Set up the same event handlers as the primary dataChannel
      incomingDataChannel.onopen = () => {
        console.log(`[WebRTC] Incoming data channel with ${peerId} opened.`);
      };

      incomingDataChannel.onclose = () => {
        console.log(`[WebRTC] Incoming data channel with ${peerId} closed.`);
      };

      incomingDataChannel.onmessage = async (ev) => {
        console.log(`[WebRTC] Message on incoming data channel from ${peerId}`);
        // Forward to the main onmessage handler or handle directly
        // This re-uses the existing onmessage logic defined for the outgoing dataChannel
        // Ensure 'dataChannel.onmessage' is robust enough or differentiate if needed
        if (dataChannel.onmessage) {
          dataChannel.onmessage(ev);
        }
      };

      // Update the peer connection with the incoming data channel
      const connections = get().peerConnections
      const connection = connections.get(peerId)

      if (connection) {
        connection.dataChannel = incomingDataChannel
        connections.set(peerId, connection)
        set({ peerConnections: new Map(connections) })
      }
    }

    // Store the peer connection
    get().peerConnections.set(peerId, {
      connection: peerConnection,
      dataChannel,
      sessionId: peerId,
    })

    // Force update the state with a new Map instance
    set({ peerConnections: new Map(get().peerConnections) })

    // Signaling listeners will be handled globally in socketStore.ts

    // Create and send an offer if this is the initiating side
    // Check if we are not already in a connection process (e.g. received an offer)
    if (peerConnection.signalingState === "stable") { // Only create offer if stable (not already processing one)
        console.log(`[WebRTC] Creating offer for peer ${peerId} as initiator.`);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log(`[WebRTC] Sending offer to ${peerId}.`);
        socket.emit("relay-offer", { offer, peerId });
    } else {
        console.log(`[WebRTC] Not creating offer for ${peerId}, signalingState is ${peerConnection.signalingState}.`);
    }
  },

  closePeerConnection: (peerId: string) => {
    console.log(`[WebRTC] closePeerConnection called for ${peerId}`);
    const connections = get().peerConnections
    const connection = connections.get(peerId)

    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close()
      }

      connection.connection.close()
      connections.delete(peerId)

      // Force update the state with a new Map instance
      set({ peerConnections: new Map(connections) })
    }
  },

  setSelectedFiles: (files: File[]) => {
    set({ selectedFiles: files })
  },

  sendFiles: async (peerId: string) => {
    console.log(`[WebRTC] sendFiles called for peerId: ${peerId}`);
    const { peerConnections, selectedFiles } = get();
    const connection = peerConnections.get(peerId);

    if (!connection) {
      console.error(`[WebRTC] No peer connection found for peerId: ${peerId} in sendFiles.`);
      return;
    }
    if (!connection.dataChannel) {
      console.error(`[WebRTC] No data channel on connection for peerId: ${peerId} in sendFiles.`);
      return;
    }
    
    console.log(`[WebRTC] Data channel state for ${peerId} before sending: ${connection.dataChannel.readyState}`);
    
    const isDataChannelNotOpen = connection.dataChannel.readyState === "connecting" || 
                               connection.dataChannel.readyState === "closing" ||
                               connection.dataChannel.readyState === "closed";

    if (isDataChannelNotOpen) {
      console.error(`[WebRTC] Data channel for ${peerId} is not open. State: ${connection.dataChannel.readyState}. Attempting to wait...`);
      // Wait for a short period to see if it opens
      for (let i = 0; i < 10; i++) { // Wait up to 5 seconds
        if (connection.dataChannel.readyState === "open") {
          console.log(`[WebRTC] Data channel for ${peerId} opened after waiting.`);
          break;
        }
        console.log(`[WebRTC] Waiting for data channel to open for ${peerId}... (${i + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const isStillNotOpen = connection.dataChannel.readyState === "connecting" || 
                             connection.dataChannel.readyState === "closing" ||
                             connection.dataChannel.readyState === "closed";
      if (isStillNotOpen) {
        console.error(`[WebRTC] Data channel for ${peerId} did not open after waiting. Aborting sendFiles.`);
        return;
      }
    }

    const { dataChannel } = connection;
    const { chunkSize, useCompression } = useSettingsStore.getState()

    // Process each selected file
    for (const file of selectedFiles) {
      // Generate a unique file ID
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Add the transfer to the state
      get().addTransfer({
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        direction: "outgoing",
        peerId,
        chunks: {
          total: Math.ceil(file.size / chunkSize),
          received: 0,
          size: chunkSize,
        },
      })

      console.log(`[WebRTC] Sending file offer for ${file.name} to ${peerId}`);
      // Send file offer
      dataChannel.send(
        JSON.stringify({
          type: "file-offer",
          data: {
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            useCompression,
          },
        }),
      )

      // Wait for acknowledgment (in a real implementation, you'd handle this properly)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Update transfer status
      get().updateTransferStatus(fileId, "transferring")

      // Set start time for speed calculation
      const transfers = get().transfers
      const transferIndex = transfers.findIndex((t) => t.fileId === fileId)

      if (transferIndex !== -1) {
        const updatedTransfers = [...transfers]
        updatedTransfers[transferIndex].startTime = Date.now()
        set({ transfers: updatedTransfers })
      }

      // Read and send file in chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      const reader = new FileReader();
      console.log(`[WebRTC] Starting to send ${totalChunks} chunks for file ${file.name} to ${peerId}`);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const currentTransfers = get().transfers;
        const currentTransfer = currentTransfers.find((t) => t.fileId === fileId);

        if (!currentTransfer || currentTransfer.status === "error") {
          console.log(`[WebRTC] Transfer ${fileId} cancelled or errored. Stopping chunk sending.`);
          break;
        }

        if (currentTransfer.status === "paused") {
          console.log(`[WebRTC] Transfer ${fileId} is paused. Waiting for resume.`);
          await new Promise<void>((resolveLoop) => { // Renamed resolve to avoid conflict
            const checkStatus = () => {
              const updatedTransfer = get().transfers.find((t) => t.fileId === fileId);
              if (updatedTransfer && updatedTransfer.status === "transferring") {
                console.log(`[WebRTC] Transfer ${fileId} resumed.`);
                resolveLoop();
              } else if (updatedTransfer && updatedTransfer.status === "error") {
                console.log(`[WebRTC] Transfer ${fileId} errored while paused.`);
                resolveLoop(); // Exit loop
              } else {
                setTimeout(checkStatus, 500);
              }
            };
            checkStatus();
          });
          // Re-check status after pause
          const afterPauseTransfer = get().transfers.find((t) => t.fileId === fileId);
          if (!afterPauseTransfer || afterPauseTransfer.status === "error") {
            console.log(`[WebRTC] Transfer ${fileId} errored after pause. Stopping chunk sending.`);
            break;
          }
        }
        
        console.log(`[WebRTC] Preparing chunk ${chunkIndex + 1}/${totalChunks} for ${file.name}`);
        // Read the chunk
        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        // Convert chunk to ArrayBuffer
        const chunkArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
          reader.onerror = reject
          reader.readAsArrayBuffer(chunk)
        })

        // Encrypt the chunk
        const { encryptedData, key, iv } = await encryptData(new Uint8Array(chunkArrayBuffer))

        // Send the chunk
        console.log(`[WebRTC] Sending chunk ${chunkIndex + 1}/${totalChunks} for ${file.name} to ${peerId}`);
        dataChannel.send(
          JSON.stringify({
            type: "file-chunk",
            data: {
              fileId,
              chunkIndex,
              totalChunks,
              chunk: Array.from(encryptedData),
              encryptionDetails: {
                key: Array.from(key),
                iv: Array.from(iv),
              },
            },
          }),
        )

        // Update progress
        const progress = (chunkIndex + 1) / totalChunks

        // Calculate speed and ETA
        const now = Date.now()
        const transfer = get().transfers.find((t) => t.fileId === fileId)
        const elapsedTime = transfer?.startTime ? (now - transfer.startTime) / 1000 : 0
        const speed = elapsedTime > 0 ? (file.size * progress) / elapsedTime : 0
        const remainingBytes = file.size * (1 - progress)
        const eta = speed > 0 ? remainingBytes / speed : 0

        get().updateTransferProgress(fileId, progress, speed, eta)

        // Wait for acknowledgment (in a real implementation, you'd handle this properly)
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Mark transfer as completed
      get().updateTransferStatus(fileId, "completed")
    }

    // Clear selected files after sending
    set({ selectedFiles: [] })
  },

  handleRelayOffer: async (offer, fromPeerId) => {
    console.log(`[WebRTC] handleRelayOffer from ${fromPeerId}`);
    let pc = get().peerConnections.get(fromPeerId)?.connection;
    const socket = useSocketStore.getState().socket;

    if (!socket) {
      console.error("[WebRTC] No socket in handleRelayOffer");
      return;
    }

    if (!pc) {
      console.log(`[WebRTC] No existing PC for ${fromPeerId}, creating one to handle offer.`);
      // Call createPeerConnection for the offering peer. 
      // This will set up the PC, data channel, and local ICE candidate listeners.
      // It will NOT create and send an offer back, because signalingState won't be 'stable'.
      await get().createPeerConnection(fromPeerId); 
      pc = get().peerConnections.get(fromPeerId)?.connection;
      if (!pc) {
        console.error(`[WebRTC] Failed to create PC for ${fromPeerId} in handleRelayOffer`);
        return;
      }
    }
    
    // Glare handling (simplified)
    // If this client also sent an offer (signalingState is 'have-local-offer'),
    // a decision must be made. A common strategy is for one peer (e.g., with the "smaller" ID) to yield.
    if (pc.signalingState === "have-local-offer") {
      const mySessionId = useSocketStore.getState().sessionId;
      // Example: if my ID is "smaller", I'll ignore their offer and expect them to handle mine.
      // This is a very basic glare resolution.
      if (mySessionId && mySessionId < fromPeerId) {
        console.warn(`[WebRTC] Glare: I (${mySessionId}) sent an offer and received one from ${fromPeerId}. I will ignore their offer.`);
        return; 
      }
      console.warn(`[WebRTC] Glare: I (${mySessionId}) sent an offer and received one from ${fromPeerId}. I will process their offer.`);
    }


    try {
      console.log(`[WebRTC] Setting remote description for offer from ${fromPeerId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      console.log(`[WebRTC] Creating answer for ${fromPeerId}`);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`[WebRTC] Sending answer to ${fromPeerId}`);
      socket.emit("relay-answer", { answer, peerId: fromPeerId });
    } catch (error) {
      console.error(`[WebRTC] Error in handleRelayOffer for ${fromPeerId}:`, error);
    }
  },

  handleRelayAnswer: async (answer, fromPeerId) => {
    console.log(`[WebRTC] handleRelayAnswer from ${fromPeerId}`);
    const pc = get().peerConnections.get(fromPeerId)?.connection;
    if (pc && pc.signalingState === "have-local-offer") {
      try {
        console.log(`[WebRTC] Setting remote description for answer from ${fromPeerId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error(`[WebRTC] Error in handleRelayAnswer for ${fromPeerId}:`, error);
      }
    } else {
      console.warn(`[WebRTC] Received answer from ${fromPeerId}, but no PC in correct state. State: ${pc?.signalingState}`);
    }
  },

  handleRelayIceCandidate: async (candidate, fromPeerId) => {
    console.log(`[WebRTC] handleRelayIceCandidate from ${fromPeerId}`);
    const pc = get().peerConnections.get(fromPeerId)?.connection;
    if (pc) {
      try {
        if (candidate && Object.keys(candidate).length > 0) { // Check if candidate is not empty
          console.log(`[WebRTC] Adding ICE candidate from ${fromPeerId}:`, candidate);
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.log(`[WebRTC] Received empty ICE candidate from ${fromPeerId}, ignoring.`);
        }
      } catch (error) {
        console.error(`[WebRTC] Error adding ICE candidate from ${fromPeerId}:`, error);
      }
    } else {
      console.warn(`[WebRTC] Received ICE candidate from ${fromPeerId}, but no PC found.`);
    }
  },

  pauseTransfer: (transferId: string) => {
    const { transfers, peerConnections } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      const transfer = transfers[transferIndex]

      // Update transfer status
      get().updateTransferStatus(transferId, "paused")

      // Send pause message to peer
      const connection = peerConnections.get(transfer.peerId)

      if (connection && connection.dataChannel) {
        connection.dataChannel.send(
          JSON.stringify({
            type: "transfer-control",
            data: {
              fileId: transferId,
              action: "pause",
            },
          }),
        )
      }
    }
  },

  resumeTransfer: (transferId: string) => {
    const { transfers, peerConnections } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      const transfer = transfers[transferIndex]

      // Update transfer status
      get().updateTransferStatus(transferId, "transferring")

      // Send resume message to peer
      const connection = peerConnections.get(transfer.peerId)

      if (connection && connection.dataChannel) {
        connection.dataChannel.send(
          JSON.stringify({
            type: "transfer-control",
            data: {
              fileId: transferId,
              action: "resume",
            },
          }),
        )
      }
    }
  },

  cancelTransfer: (transferId: string) => {
    const { transfers, peerConnections } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      const transfer = transfers[transferIndex]

      // Update transfer status
      get().updateTransferStatus(transferId, "error", "Transfer cancelled")

      // Send cancel message to peer
      const connection = peerConnections.get(transfer.peerId)

      if (connection && connection.dataChannel) {
        connection.dataChannel.send(
          JSON.stringify({
            type: "transfer-control",
            data: {
              fileId: transferId,
              action: "cancel",
            },
          }),
        )
      }
    }
  },

  acceptTransfer: (transferId: string) => {
    const { transfers } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      // Update transfer status
      get().updateTransferStatus(transferId, "transferring")

      // Set start time for speed calculation
      const updatedTransfers = [...transfers]
      updatedTransfers[transferIndex].startTime = Date.now()
      set({ transfers: updatedTransfers })
    }
  },

  rejectTransfer: (transferId: string) => {
    get().cancelTransfer(transferId)
  },

  updateTransferProgress: (transferId: string, progress: number, speed: number, eta: number) => {
    const { transfers } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      const updatedTransfers = [...transfers]
      updatedTransfers[transferIndex].progress = progress
      updatedTransfers[transferIndex].speed = speed
      updatedTransfers[transferIndex].eta = eta
      set({ transfers: updatedTransfers })
    }
  },

  addTransfer: (transfer) => {
    const newTransfer: FileTransfer = {
      ...transfer,
      progress: 0,
      speed: 0,
      eta: 0,
      status: "pending",
    }

    set((state) => ({
      transfers: [...state.transfers, newTransfer],
    }))

    return newTransfer.fileId
  },

  updateTransferStatus: (transferId: string, status: FileTransfer["status"], error?: string) => {
    const { transfers } = get()
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId)

    if (transferIndex !== -1) {
      const updatedTransfers = [...transfers]
      updatedTransfers[transferIndex].status = status

      if (error) {
        updatedTransfers[transferIndex].error = error
      }

      set({ transfers: updatedTransfers })
    }
  },
}))
