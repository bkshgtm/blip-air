import { create } from "zustand"
import { NavigateFunction } from "react-router-dom"; // Import NavigateFunction
import { useSocketStore } from "./socketStore"
import { useSettingsStore } from "./settingsStore"
// Removed encryption imports

interface PeerConnection {
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  sessionId: string
  queuedIceCandidates?: RTCIceCandidate[]; // Add this line
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
    data?: Uint8Array[] // To store received chunk data on receiver
  }
  fileBlob?: Blob // To store the final assembled file on receiver
  fileHandle?: FileSystemFileHandle // For File System Access API
  writableStream?: FileSystemWritableFileStream // For File System Access API
  usesFileSystemAccessAPI?: boolean // Flag to indicate API usage
  startTime?: number
  error?: string
  _notified?: boolean
  // cryptoKey field removed
}

interface WebRTCState {
  peerConnections: Map<string, PeerConnection>
  transfers: FileTransfer[]
  selectedFiles: File[]
  pendingFileAcceptances: Map<string, { resolve: (value: unknown) => void; reject: (reason?: any) => void }>


  // Methods for managing connections
  createPeerConnection: (peerId: string, isAnsweringOffer?: boolean) => Promise<void>
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
  processQueuedIceCandidates: (peerId: string) => Promise<void>; // Add this line
  
  // Navigation utility
  navigate?: NavigateFunction;
  setNavigate: (navigate: NavigateFunction) => void;
}

// Default RTCPeerConnection configuration
const DEFAULT_PC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443"
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:openrelay.metered.ca:443?transport=tcp", // Secure TURN over TCP
      username: "openrelayproject",
      credential: "openrelayproject",
    }
  ],
  iceTransportPolicy: 'all' as RTCIceTransportPolicy, // Allow all candidate types
};

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  peerConnections: new Map(),
  transfers: [],
  selectedFiles: [],
  pendingFileAcceptances: new Map(),
  navigate: undefined,
  setNavigate: (navigateFn) => set({ navigate: navigateFn }),

  createPeerConnection: async (peerId: string, isAnsweringOffer: boolean = false) => {
    console.log(`[WebRTC] createPeerConnection called for peerId: ${peerId}, isAnsweringOffer: ${isAnsweringOffer}`);
    const socket = useSocketStore.getState().socket
    if (!socket) {
      console.error("[WebRTC] No socket available in createPeerConnection");
      return;
    }

    const existingPeerEntry = get().peerConnections.get(peerId);

    if (existingPeerEntry && existingPeerEntry.dataChannel?.readyState === "open" && existingPeerEntry.connection.connectionState === "connected") {
      console.log(`[WebRTC] Reusing existing open data channel for peer ${peerId}`);
      // Ensure event listeners are correctly (re-)attached or handled if needed,
      // though for a simple reuse, if they were set up on the existing channel, they might still be active.
      // For this simplified reuse, we assume the existing channel and its listeners are fine.
      
      // If we are answering an offer, but the connection is already established and channel open,
      // it might indicate a re-negotiation or a redundant offer.
      // The current logic outside this block handles offer/answer for new connections.
      // For a simple reuse, we might not need to do full offer/answer again if channel is open.
      // However, if `isAnsweringOffer` is true, it implies we received an offer that needs a response.
      // This part needs careful thought for full robustness.
      // For now, if channel is open, we assume it's ready.
      if (isAnsweringOffer) {
        console.warn(`[WebRTC] createPeerConnection called with isAnsweringOffer=true for an already connected peer ${peerId} with an open data channel. This might be a redundant offer or require re-negotiation not yet fully handled by this simplified reuse logic.`);
        // Potentially, we might still need to process the offer/answer cycle even on an existing connection
        // if the offer indicates a change that requires it.
        // For now, we'll let the offer/answer logic proceed if isAnsweringOffer is true,
        // but it will operate on the NEW pc object created below if this simplified reuse isn't sufficient.
        // This is a known area for future refinement.
      } else {
        // If not answering an offer and channel is open, we can likely just return.
        // The `sendFiles` will use this existing open channel.
        return;
      }
    } else if (existingPeerEntry) {
      console.log(`[WebRTC] Existing connection found for peer ${peerId}, but data channel is not open or connection not connected. State: ${existingPeerEntry.connection.connectionState}, DataChannel: ${existingPeerEntry.dataChannel?.readyState}. Proceeding to create new connection setup.`);
      // Optionally, close the old one before creating a new one to clean up resources
      existingPeerEntry.connection.close();
      if (existingPeerEntry.dataChannel) {
        existingPeerEntry.dataChannel.close();
      }
      get().peerConnections.delete(peerId); // Remove old entry
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for peer ${peerId}`);
    const peerConnection = new RTCPeerConnection(DEFAULT_PC_CONFIG);

    // Store the new peer connection early so it's available for event handlers
    // This will overwrite the old one if we decided to recreate
    const newPeerEntry: PeerConnection = {
      connection: peerConnection,
      sessionId: peerId,
      // dataChannel will be added after creation
    };
    get().peerConnections.set(peerId, newPeerEntry);
    set({ peerConnections: new Map(get().peerConnections) });


    peerConnection.oniceconnectionstatechange = async () => {
      console.log(`[WebRTC] ICE connection state changed for peer ${peerId}: ${peerConnection.iceConnectionState}`);
      // Log stats when connection state might be final or problematic
      if (['connected', 'completed', 'failed', 'disconnected'].includes(peerConnection.iceConnectionState)) {
        try {
          const stats = await peerConnection.getStats();
          let foundSelectedPair = false;
          stats.forEach(report => {
            // Standard-based check for the active candidate pair
            if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
              const local = stats.get(report.localCandidateId);
              const remote = stats.get(report.remoteCandidateId);
              console.log(`[WebRTC] Stats: Active Candidate Pair for ${peerId} (ID: ${report.id}):
  Local: ${local?.address}:${local?.port} (${local?.candidateType}, ${local?.protocol})
  Remote: ${remote?.address}:${remote?.port} (${remote?.candidateType}, ${remote?.protocol})
  RTT: ${report.currentRoundTripTime}s, State: ${report.state}`);
              foundSelectedPair = true;
            }
          });
          if (!foundSelectedPair) {
            // Fallback for more general transport info if specific pair not found or for overall transport state
            stats.forEach(report => {
              if (report.type === 'transport' && report.selectedCandidatePairId) {
                 const selectedPair = stats.get(report.selectedCandidatePairId);
                 if (selectedPair) {
                    const localCandidate = stats.get(selectedPair.localCandidateId);
                    const remoteCandidate = stats.get(selectedPair.remoteCandidateId);
                    console.log(`[WebRTC] Stats: Transport Selected Candidate Pair ID ${report.selectedCandidatePairId} for ${peerId}:
  Local: ${localCandidate?.address}:${localCandidate?.port} (${localCandidate?.candidateType}, ${localCandidate?.protocol})
  Remote: ${remoteCandidate?.address}:${remoteCandidate?.port} (${remoteCandidate?.candidateType}, ${remoteCandidate?.protocol})
  Pair State: ${selectedPair.state}`);
                 }
              }
            });
          }
        } catch (err) {
          console.error(`[WebRTC] Error getting stats for ${peerId}:`, err);
        }
      }
    };

    peerConnection.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state changed for peer ${peerId}: ${peerConnection.signalingState}`);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state changed for peer ${peerId}: ${peerConnection.iceGatheringState}`);
    };

    peerConnection.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
      console.error(`[WebRTC] ICE candidate error for peer ${peerId}: Address: ${event.address}, Port: ${event.port}, URL: ${event.url}, Error Code: ${event.errorCode}, Error Text: ${event.errorText}`);
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state changed for peer ${peerId}: ${peerConnection.connectionState}`);
    };

    // Create a data channel for file transfer
    const dataChannel = peerConnection.createDataChannel("fileTransfer", {
      ordered: true,
    });
    dataChannel.binaryType = "arraybuffer"; // Set binary type for outgoing channel

    // Set up data channel event handlers
    dataChannel.onopen = () => {
      console.log(`[WebRTC] Data channel opened with peer ${peerId}`);
    }

    dataChannel.onclose = () => {
      console.log(`[WebRTC] Data channel closed with peer ${peerId}`);
    }
    
    // Receiver state for pending binary chunk metadata
    let pendingChunkMetadata: { fileId: string; chunkIndex: number; totalChunks: number } | null = null;

    dataChannel.onmessage = async (event) => {
      // Differentiate between string (JSON metadata) and ArrayBuffer (chunk data)
      if (typeof event.data === 'string') {
        console.log(`[WebRTC] Received string message from ${peerId}`);
        try {
          const message = JSON.parse(event.data);

          if (message.type === "file-offer") {
          // Handle file offer
          const { fileId, fileName, fileSize, fileType } = message.data 

          get().addTransfer({ // This will update 'transfers' array
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
          });

          // Navigate to transfer page if navigate function is set and not already there
          const navigate = get().navigate;
          if (navigate && window.location.pathname !== "/transfer") {
            navigate("/transfer");
          }
          // The scroll logic in TransferPage.tsx will handle scrolling to bottom

          // Send acknowledgment
          dataChannel.send(
            JSON.stringify({
              type: "file-offer-ack",
              data: { fileId },
            }),
          );
        } else if (message.type === "file-accepted") {
          // Handle file acceptance from receiver
          const { fileId: acceptedFileId } = message.data;
          const acceptance = get().pendingFileAcceptances.get(acceptedFileId);
          if (acceptance) {
            console.log(`[WebRTC] Received file-accepted for ${acceptedFileId}`);
            acceptance.resolve(true);
            get().pendingFileAcceptances.delete(acceptedFileId);
            // Update transfer status to transferring on sender side as well
            get().updateTransferStatus(acceptedFileId, "transferring");
             // Set start time for speed calculation
            const transfers = get().transfers;
            const transferIndex = transfers.findIndex((t) => t.fileId === acceptedFileId);
            if (transferIndex !== -1) {
              const updatedTransfers = [...transfers];
              updatedTransfers[transferIndex].startTime = Date.now();
              set({ transfers: updatedTransfers });
            }
          }
        } else if (message.type === "file-rejected") {
          // Handle file rejection from receiver
          const { fileId: rejectedFileId } = message.data;
          const acceptance = get().pendingFileAcceptances.get(rejectedFileId);
          if (acceptance) {
            console.log(`[WebRTC] Received file-rejected for ${rejectedFileId}`);
            acceptance.reject(new Error("File transfer rejected by peer"));
            get().pendingFileAcceptances.delete(rejectedFileId);
            get().updateTransferStatus(rejectedFileId, "error", "Rejected by peer");
          }
        } else if (message.type === "file-chunk") {
          } else if (message.type === "file-chunk-meta") { // New message type for chunk metadata
            console.log(`[WebRTC] Received chunk-meta from ${peerId}:`, message.data);
            pendingChunkMetadata = message.data;
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
          console.error("[WebRTC] Error processing string message:", error, event.data);
        }
      } else if (event.data instanceof ArrayBuffer) {
        console.log(`[WebRTC] Received ArrayBuffer (chunk data) from ${peerId}`);
        if (!pendingChunkMetadata) {
          console.error("[WebRTC] Received ArrayBuffer chunk without prior metadata. Discarding.");
          return;
        }

        const { fileId, chunkIndex, totalChunks } = pendingChunkMetadata;
        pendingChunkMetadata = null; // Clear after use

        const plainChunk = new Uint8Array(event.data);

        const transfers = get().transfers;
        const transferIndex = transfers.findIndex((t) => t.fileId === fileId && t.direction === "incoming");

        if (transferIndex === -1) {
          console.warn(`[WebRTC] Received chunk for unknown transfer (after metadata): ${fileId}`);
          // Acknowledge with original metadata to keep sender in sync if possible
          dataChannel.send(JSON.stringify({ type: "chunk-ack", data: { fileId, chunkIndex } }));
          return;
        }
        
        // Process the chunk (logic moved from old "file-chunk" JSON message type)
          console.log(`[WebRTC] Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId} from peer ${peerId}`);

          // const transfers = get().transfers; // Already declared above in the scope of onmessage
          // Ensure we are modifying the correct incoming transfer
          // const transferIndex = transfers.findIndex((t) => t.fileId === fileId && t.direction === "incoming"); // Already declared above

          if (transferIndex !== -1) {
            let transfer = { ...transfers[transferIndex] }; 

            // If transfer is already marked as error (e.g. cancelled), ignore further chunks for it
            if (transfer.status === "error") {
              console.log(`[WebRTC] Ignoring chunk for already errored/cancelled transfer ${fileId}`);
              // Acknowledge the chunk to prevent sender from potentially resending or stalling,
              // but don't process it further.
              dataChannel.send(JSON.stringify({ type: "chunk-ack", data: { fileId, chunkIndex } }));
              return; 
            }

            // Initialize chunks.data if not using File System Access API and it doesn't exist
            if (!transfer.usesFileSystemAccessAPI && !transfer.chunks.data) {
              transfer.chunks.data = [];
            }

            if (transfer.usesFileSystemAccessAPI && transfer.writableStream) {
              try {
                await transfer.writableStream.write(plainChunk); // Use plainChunk
                console.log(`[WebRTC] Chunk ${chunkIndex + 1} written to disk via File System Access API for ${transfer.fileName}`);
              } catch (err: any) {
                console.error(`[WebRTC] Error writing chunk to disk for ${transfer.fileName}:`, err.message);
                transfer.status = "error";
                transfer.error = "Disk write error";
                // Close the stream on error
                if (transfer.writableStream) {
                  try { await transfer.writableStream.close(); } catch (closeErr) { /* ignore */ }
                }
                transfer.writableStream = undefined; // Clear the stream
              }
            } else {
              // Fallback: Store the plain chunk in memory
              if (transfer.chunks.data) { 
                 transfer.chunks.data[chunkIndex] = plainChunk; // Use plainChunk
              } else if (!transfer.usesFileSystemAccessAPI) { 
                 console.error("[WebRTC] Fallback to Blob: chunks.data not initialized!");
                 transfer.chunks.data = [plainChunk]; // Use plainChunk
              }
            }
            transfer.chunks.received = chunkIndex + 1;
            
            const newProgress = transfer.chunks.received / transfer.chunks.total;

            // Calculate speed and ETA
            const now = Date.now();
            const elapsedTime = transfer.startTime ? (now - transfer.startTime) / 1000 : 0;
            const speed = elapsedTime > 0 ? (transfer.fileSize * newProgress) / elapsedTime : 0;
            const remainingBytes = transfer.fileSize * (1 - newProgress);
            const eta = speed > 0 ? remainingBytes / speed : 0;

            // Directly update the local transfer copy
            transfer.progress = newProgress;
            transfer.speed = speed;
            transfer.eta = eta;
            
            let finalStatus = transfer.status; // Keep current status unless changed

            // If all chunks received, finalize and mark as completed
            if (transfer.chunks.received === transfer.chunks.total && transfer.status !== "error") {
              if (transfer.usesFileSystemAccessAPI && transfer.writableStream) {
                try {
                  await transfer.writableStream.close();
                  console.log(`[WebRTC] File ${transfer.fileName} (${fileId}) fully written to disk and stream closed.`);
                  finalStatus = "completed";
                  transfer.writableStream = undefined; // Clear the stream
                } catch (err: any) {
                  console.error(`[WebRTC] Error closing writable stream for ${transfer.fileName}:`, err.message);
                  transfer.error = "Error finalizing file on disk";
                  finalStatus = "error";
                }
              } else if (!transfer.usesFileSystemAccessAPI) { // Fallback to Blob
                if (transfer.chunks.data && transfer.chunks.data.length === transfer.chunks.total && transfer.chunks.data.every(c => c instanceof Uint8Array)) {
                  const fileBlob = new Blob(transfer.chunks.data, { type: transfer.fileType });
                  transfer.fileBlob = fileBlob;
                  // Optionally clear chunks.data to free memory
                  // delete transfer.chunks.data; 
                  console.log(`[WebRTC] File ${transfer.fileName} (${fileId}) fully received and assembled into a Blob.`);
                  finalStatus = "completed";
                } else {
                  console.error(`[WebRTC] Blob Fallback: All chunks received for ${transfer.fileName} (${fileId}), but chunk data is incomplete or invalid.`);
                  transfer.error = "Chunk data missing/invalid for Blob";
                  finalStatus = "error";
                }
              }
            }
            
            // Update the specific transfer in the transfers array
            const updatedTransfersArray = get().transfers.map((t, idx) => 
              idx === transferIndex ? transfer : t
            );
            set({ transfers: updatedTransfersArray });

            // Update status separately if it changed (e.g., to completed or error)
            if (finalStatus !== transfer.status) {
                 get().updateTransferStatus(fileId, finalStatus, transfer.error);
            }

          } else {
            console.warn(`[WebRTC] Received chunk for unknown or non-incoming transfer ${fileId}`);
          }

          // Send acknowledgment (moved inside the ArrayBuffer processing block)
          dataChannel.send(
            JSON.stringify({
              type: "chunk-ack",
              data: { fileId, chunkIndex }, 
            }),
          );
        } else {
          console.warn("[WebRTC] Received unknown message type on data channel:", event.data);
        }
      } // End of onmessage handler

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
      incomingDataChannel.binaryType = "arraybuffer"; // Set binary type for incoming channel
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

    // Update the peer entry with the created dataChannel
    const currentEntry = get().peerConnections.get(peerId);
    if (currentEntry && currentEntry.connection === peerConnection) { // Ensure we're updating the correct entry
        currentEntry.dataChannel = dataChannel;
        get().peerConnections.set(peerId, currentEntry);
        set({ peerConnections: new Map(get().peerConnections) });
    } else {
        // This case should ideally not happen if logic is correct,
        // means the peerConnection object in the map was changed by something else.
        console.error(`[WebRTC] Mismatch or missing peer entry when trying to set dataChannel for ${peerId}`);
        // Fallback: create a new entry if it was somehow deleted or is a different PC object
        get().peerConnections.set(peerId, {
            connection: peerConnection,
            dataChannel,
            sessionId: peerId,
        });
        set({ peerConnections: new Map(get().peerConnections) });
    }

    // Signaling listeners are handled globally in socketStore.ts

    // Create and send an offer if this is the initiating side AND we are not just answering an offer
    // Check if we are not already in a connection process (e.g. received an offer)
    if (!isAnsweringOffer && peerConnection.signalingState === "stable") { 
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
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Key generation and export removed

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
      });

      console.log(`[WebRTC] Sending file offer for ${file.name} to ${peerId}`);
      dataChannel.send(
        JSON.stringify({
          type: "file-offer",
          data: { // rawKeyBytes removed from payload
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            useCompression,
          },
        }),
      );

      // Wait for the receiver to accept the file offer
      console.log(`[WebRTC] Waiting for acceptance of file ${file.name} (${fileId}) from ${peerId}`);
      try {
        await new Promise((resolve, reject) => {
          get().pendingFileAcceptances.set(fileId, { resolve, reject });
          // Set a timeout for acceptance
          setTimeout(() => {
            if (get().pendingFileAcceptances.has(fileId)) {
              get().pendingFileAcceptances.delete(fileId);
              reject(new Error("File offer acceptance timeout"));
              get().updateTransferStatus(fileId, "error", "Acceptance timeout");
            }
          }, 30000); // 30-second timeout for acceptance
        });
        console.log(`[WebRTC] File offer for ${file.name} (${fileId}) accepted by ${peerId}. Starting transfer.`);
      } catch (error: any) {
        console.error(`[WebRTC] File offer for ${file.name} (${fileId}) was not accepted or timed out:`, error.message);
        get().updateTransferStatus(fileId, "error", error.message || "Offer not accepted");
        continue; // Move to the next file if this one wasn't accepted
      }

      // If accepted, status is already set to 'transferring' by the 'file-accepted' handler
      // and startTime is also set.

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

        // Send chunk metadata as JSON
        dataChannel.send(
          JSON.stringify({
            type: "file-chunk-meta",
            data: {
              fileId,
              chunkIndex,
              totalChunks,
            },
          }),
        );
        
        // Send actual chunk data as ArrayBuffer
        console.log(`[WebRTC] Sending ArrayBuffer chunk ${chunkIndex + 1}/${totalChunks} for ${file.name} to ${peerId}`);
        dataChannel.send(chunkArrayBuffer);

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

        // Reduce delay to allow faster sending, relying more on WebRTC's flow control.
        await new Promise((resolve) => setTimeout(resolve, 1)) // Reduced from 50ms to 1ms
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
      console.log(`[WebRTC] No existing PC for ${fromPeerId}, creating one to handle offer by calling createPeerConnection with isAnsweringOffer=true.`);
      await get().createPeerConnection(fromPeerId, true); // Pass true here
      pc = get().peerConnections.get(fromPeerId)?.connection;
      if (!pc) {
        console.error(`[WebRTC] Failed to create PC for ${fromPeerId} in handleRelayOffer`);
        return;
      }
    } else if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
        // If PC exists but is in a state not ready to receive an offer (e.g., have-local-offer)
        // This is part of glare handling.
        const mySessionId = useSocketStore.getState().sessionId;
        if (mySessionId && mySessionId < fromPeerId) { // My ID is "smaller", I initiated, they should yield.
             console.warn(`[WebRTC] Glare in handleRelayOffer: I (${mySessionId}) sent an offer to ${fromPeerId} and they also sent one. My ID is smaller, I expect them to handle my offer. Ignoring their offer.`);
             return;
        }
         console.warn(`[WebRTC] Glare in handleRelayOffer: I (${mySessionId}) sent an offer to ${fromPeerId} and they also sent one. My ID is larger/equal, I will process their offer.`);
    }


    try {
      console.log(`[WebRTC] Setting remote description for offer from ${fromPeerId}. Current signaling state: ${pc.signalingState}`);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await get().processQueuedIceCandidates(fromPeerId); // Process queued candidates
      
      console.log(`[WebRTC] Creating answer for ${fromPeerId}. Current signaling state: ${pc.signalingState}`);
      const answer = await pc.createAnswer();
      console.log(`[WebRTC] Setting local description for answer to ${fromPeerId}.`);
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
        await get().processQueuedIceCandidates(fromPeerId); // Process queued candidates
      } catch (error) {
        console.error(`[WebRTC] Error in handleRelayAnswer for ${fromPeerId}:`, error);
      }
    } else {
      console.warn(`[WebRTC] Received answer from ${fromPeerId}, but no PC in correct state. State: ${pc?.signalingState}`);
    }
  },

  handleRelayIceCandidate: async (candidate, fromPeerId) => {
    console.log(`[WebRTC] handleRelayIceCandidate from ${fromPeerId}`);
    const peerConnectionEntry = get().peerConnections.get(fromPeerId);
    if (!peerConnectionEntry) {
      console.warn(`[WebRTC] Received ICE candidate from ${fromPeerId}, but no PC entry found.`);
      return;
    }

    const pc = peerConnectionEntry.connection;
    
    // Ensure candidate is not null or just an empty object before creating RTCIceCandidate
    if (!candidate || (typeof candidate === 'object' && Object.keys(candidate).length === 0 && !candidate.candidate)) {
        console.log(`[WebRTC] Received null or truly empty ICE candidate object from ${fromPeerId}, typically signals end of candidates.`);
        // Browsers send an empty candidate string "" to signal the end, or null.
        // RTCIceCandidate constructor can handle candidate: "" or candidate: null.
        // If the candidate object itself is null/empty, we might not need to do anything or just log.
        // For safety, we'll proceed if it's a valid-looking candidate structure or an empty string for candidate.
        if (candidate && typeof candidate.candidate !== 'string') {
             console.log(`[WebRTC] Received malformed ICE candidate from ${fromPeerId}, ignoring:`, candidate);
             return;
        }
    }
    
    const candidateInstance = new RTCIceCandidate(candidate);

    if (pc.remoteDescription) {
      try {
        if (candidateInstance.candidate) { 
          console.log(`[WebRTC] Remote description is set. Adding ICE candidate from ${fromPeerId}:`, candidateInstance);
          await pc.addIceCandidate(candidateInstance);
        } else {
          console.log(`[WebRTC] Received end-of-candidates signal from ${fromPeerId}.`);
          // No need to call addIceCandidate with an empty/null candidate string if the object itself is structured
          // The browser handles the end-of-candidates signal.
        }
      } catch (error) {
        console.error(`[WebRTC] Error adding ICE candidate from ${fromPeerId}:`, error);
      }
    } else {
      console.log(`[WebRTC] Remote description not set for ${fromPeerId}. Queuing ICE candidate.`);
      if (!peerConnectionEntry.queuedIceCandidates) {
        peerConnectionEntry.queuedIceCandidates = [];
      }
      peerConnectionEntry.queuedIceCandidates.push(candidateInstance);
    }
  },

  processQueuedIceCandidates: async (peerId: string) => {
    const peerConnectionEntry = get().peerConnections.get(peerId);
    if (peerConnectionEntry && peerConnectionEntry.queuedIceCandidates && peerConnectionEntry.connection.remoteDescription) {
      const pc = peerConnectionEntry.connection;
      console.log(`[WebRTC] Processing ${peerConnectionEntry.queuedIceCandidates.length} queued ICE candidates for ${peerId}`);
      while (peerConnectionEntry.queuedIceCandidates.length > 0) {
        const candidate = peerConnectionEntry.queuedIceCandidates.shift();
        if (candidate) {
          try {
            if (candidate.candidate) { // Ensure there's an actual candidate string
              console.log(`[WebRTC] Adding queued ICE candidate for ${peerId}:`, candidate);
              await pc.addIceCandidate(candidate);
            } else {
               console.log(`[WebRTC] Ignoring empty/end-of-candidates queued ICE signal for ${peerId}.`);
            }
          } catch (error) {
            console.error(`[WebRTC] Error adding queued ICE candidate for ${peerId}:`, error);
          }
        }
      }
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

  acceptTransfer: async (transferId: string) => { // This is called by the RECEIVER - now async
    const { transfers, peerConnections, updateTransferStatus } = get();
    const transferIndex = transfers.findIndex((t) => t.fileId === transferId && t.direction === "incoming" && t.status === "pending");

    if (transferIndex === -1) {
      console.warn(`[WebRTC] acceptTransfer called for ${transferId}, but no pending incoming transfer found.`);
      return;
    }

    let transferToUpdate = { ...transfers[transferIndex] }; // Work with a copy

    // Attempt to use File System Access API
    const hasShowSaveFilePicker = 'showSaveFilePicker' in window;
    const isShowSaveFilePickerFunction = typeof window.showSaveFilePicker === 'function';
    console.log(`[WebRTC] Checking File System Access API: 'showSaveFilePicker' in window? ${hasShowSaveFilePicker}, typeof === 'function'? ${isShowSaveFilePickerFunction}`);

    if (hasShowSaveFilePicker && isShowSaveFilePickerFunction) {
      console.log(`[WebRTC] 'showSaveFilePicker' IS available. Attempting to use for ${transferToUpdate.fileName}`);
      try {
        const fileExtension = transferToUpdate.fileName.split('.').pop();
        const typesConfig = fileExtension ? [{
          description: 'Original file type',
          // Ensure MIME type is valid, fallback if not.
          accept: { [(transferToUpdate.fileType && transferToUpdate.fileType.includes('/')) ? transferToUpdate.fileType : 'application/octet-stream']: [`.${fileExtension}`] },
        }] : []; // If no extension, pass empty array for types. Some browsers are strict.
        
        console.log(`[WebRTC] Calling window.showSaveFilePicker with suggestedName: ${transferToUpdate.fileName}, types:`, JSON.stringify(typesConfig));
        
        const handle = await window.showSaveFilePicker({
          suggestedName: transferToUpdate.fileName,
          types: typesConfig,
        });
        console.log(`[WebRTC] showSaveFilePicker SUCCEEDED for ${transferToUpdate.fileName}. Handle:`, handle);
        transferToUpdate.fileHandle = handle;
        transferToUpdate.writableStream = await handle.createWritable();
        transferToUpdate.usesFileSystemAccessAPI = true;
        console.log(`[WebRTC] File handle and writable stream obtained for ${transferToUpdate.fileName}`);
      } catch (err: any) {
        console.error(`[WebRTC] File System Access API showSaveFilePicker FAILED or was cancelled for ${transferToUpdate.fileName}. Error name: ${err.name}, message: ${err.message}`, err);
        if (err.name === 'AbortError') {
          // User cancelled the save dialog, treat as rejection
          // Update status and send rejection message
          const updatedErrorTransfers = get().transfers.map(t => 
            t.fileId === transferId ? { ...t, status: "error", error: "Save cancelled by user" } as FileTransfer : t
          );
          set({ transfers: updatedErrorTransfers });
          
          const connection = peerConnections.get(transferToUpdate.peerId);
          if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
            connection.dataChannel.send(JSON.stringify({ type: "file-rejected", data: { fileId: transferId } }));
          }
          return; // Stop further processing for this transfer
        }
        // For other errors, we'll fall back to Blob method below
        transferToUpdate.usesFileSystemAccessAPI = false; 
      }
    } else {
      console.log(`[WebRTC] File System Access API not available. Falling back to Blob method for ${transferToUpdate.fileName}`);
      transferToUpdate.usesFileSystemAccessAPI = false;
    }

    // Prepare the final state update for this transfer
    transferToUpdate.status = "transferring";
    transferToUpdate.startTime = Date.now();
    // usesFileSystemAccessAPI, fileHandle, writableStream are already set on transferToUpdate if FSA was used

    const finalUpdatedTransfers = get().transfers.map(t =>
      t.fileId === transferId ? transferToUpdate : t
    );
    set({ transfers: finalUpdatedTransfers });

    // Send "file-accepted" message to the sender
    const connection = peerConnections.get(transferToUpdate.peerId);
    if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
      console.log(`[WebRTC] Receiver accepting file ${transferId}. Sending file-accepted to ${transferToUpdate.peerId}`);
      connection.dataChannel.send(
        JSON.stringify({
          type: "file-accepted",
          data: { fileId: transferId },
        }),
      );
    } else {
      console.error(`[WebRTC] Cannot send file-accepted for ${transferId}: Data channel not open or connection missing.`);
      // Revert transfer status to error if acceptance couldn't be sent
      const revertedTransfers = get().transfers.map(t => 
        t.fileId === transferId ? { ...t, status: "error", error: "Failed to send acceptance (channel issue)" } as FileTransfer : t
      );
      set({ transfers: revertedTransfers });
    }
  },

  rejectTransfer: (transferId: string) => { // This is called by the RECEIVER
    const { transfers, peerConnections } = get();
    const transferToReject = transfers.find((t) => t.fileId === transferId && t.direction === "incoming" && t.status === "pending");

    if (transferToReject) {
      const updatedTransfers = transfers.map(t => 
        t.fileId === transferId ? { ...t, status: "error", error: "Rejected by you" } as FileTransfer : t
      );
      set({ transfers: updatedTransfers });

      // Send "file-rejected" message to the sender
      const connection = peerConnections.get(transferToReject.peerId);
      if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
        console.log(`[WebRTC] Receiver rejecting file ${transferId}. Sending file-rejected to ${transferToReject.peerId}`);
        connection.dataChannel.send(
          JSON.stringify({
            type: "file-rejected",
            data: { fileId: transferId },
          }),
        );
      } else {
        console.error(`[WebRTC] Cannot send file-rejected for ${transferId}: Data channel not open or connection missing.`);
      }
    } else {
      console.warn(`[WebRTC] rejectTransfer called for ${transferId}, but no pending incoming transfer found or status is not pending.`);
    }
    // We don't call get().cancelTransfer() here as that's more for an active transfer.
    // The status is already set to error.
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
