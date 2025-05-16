import { create } from "zustand"
import { NavigateFunction } from "react-router-dom"
import { useSocketStore } from "./socketStore"
import { useSettingsStore } from "./settingsStore"
import { calculateProgress } from "../lib/chunking"

interface PeerConnection {
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  sessionId: string
  queuedIceCandidates?: RTCIceCandidate[]
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
    data?: (Uint8Array | null)[]
    receivedIndices?: Set<number>
  }
  fileBlob?: Blob
  fileHandle?: FileSystemFileHandle
  writableStream?: FileSystemWritableFileStream
  usesFileSystemAccessAPI?: boolean
  startTime?: number
  error?: string
  _notified?: boolean
}

interface WebRTCState {
  peerConnections: Map<string, PeerConnection>
  transfers: FileTransfer[]
  selectedFiles: File[]
  pendingFileAcceptances: Map<string, { resolve: (value: unknown) => void; reject: (reason?: any) => void }>

  createPeerConnection: (peerId: string, isAnsweringOffer?: boolean) => Promise<void>
  closePeerConnection: (peerId: string) => void

  setSelectedFiles: (files: File[]) => void
  sendFiles: (peerId: string) => Promise<void>
  pauseTransfer: (transferId: string) => void
  resumeTransfer: (transferId: string) => void
  cancelTransfer: (transferId: string) => void
  acceptTransfer: (transferId: string) => void
  rejectTransfer: (transferId: string) => void

  updateTransferProgress: (transferId: string, progress: number, speed: number, eta: number) => void
  addTransfer: (transfer: Omit<FileTransfer, "progress" | "speed" | "eta" | "status">) => string
  updateTransferStatus: (transferId: string, status: FileTransfer["status"], error?: string) => void
  clearAllTransfers: () => void

  handleRelayOffer: (offer: RTCSessionDescriptionInit, fromPeerId: string) => Promise<void>
  handleRelayAnswer: (answer: RTCSessionDescriptionInit, fromPeerId: string) => Promise<void>
  handleRelayIceCandidate: (candidate: RTCIceCandidateInit, fromPeerId: string) => Promise<void>
  processQueuedIceCandidates: (peerId: string) => Promise<void>

  navigate?: NavigateFunction
  setNavigate: (navigate: NavigateFunction) => void

  downloadFile: (transferId: string) => void
  retryConnectionWithRelay: (peerId: string) => Promise<void>
}

// Optimized configuration with fewer STUN/TURN servers for faster discovery
const DEFAULT_PC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      // Keep the STUN server for NAT traversal
      urls: [import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302"],
    },
    {
      // Use only two TURN servers - one for UDP and one for TCP fallback
      urls: [
        import.meta.env.VITE_TURN_URL_1 || "turn:standard.relay.metered.ca:80", // UDP
        import.meta.env.VITE_TURN_URL_2 || "turn:standard.relay.metered.ca:80?transport=tcp", // TCP fallback
      ],
      username: import.meta.env.VITE_TURN_USERNAME || "openrelayproject",
      credential: import.meta.env.VITE_TURN_CREDENTIAL || "openrelayproject",
    },
  ],
  iceTransportPolicy: "all" as RTCIceTransportPolicy,
  iceCandidatePoolSize: 5, // Reduced from 10 to 5 for faster gathering
}

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  peerConnections: new Map(),
  transfers: [],
  selectedFiles: [],
  pendingFileAcceptances: new Map(),
  navigate: undefined,
  setNavigate: (navigateFn) => set({ navigate: navigateFn }),

  createPeerConnection: async (peerId: string, isAnsweringOffer: boolean = false) => {
    console.log(`[WebRTC] createPeerConnection called for peerId: ${peerId}, isAnsweringOffer: ${isAnsweringOffer}`)
    const socket = useSocketStore.getState().socket
    if (!socket) {
      console.error("[WebRTC] No socket available in createPeerConnection")
      return
    }

    const existingPeerEntry = get().peerConnections.get(peerId)

    if (
      existingPeerEntry &&
      existingPeerEntry.dataChannel?.readyState === "open" &&
      existingPeerEntry.connection.connectionState === "connected"
    ) {
      console.log(`[WebRTC] Reusing existing open data channel for peer ${peerId}`)
      if (isAnsweringOffer) {
        console.warn(
          `[WebRTC] createPeerConnection called with isAnsweringOffer=true for an already connected peer ${peerId} with an open data channel. This might be a redundant offer or require re-negotiation not yet fully handled by this simplified reuse logic.`,
        )
      } else {
        return
      }
    } else if (existingPeerEntry) {
      console.log(
        `[WebRTC] Existing connection found for peer ${peerId}, but data channel is not open or connection not connected. State: ${existingPeerEntry.connection.connectionState}, DataChannel: ${existingPeerEntry.dataChannel?.readyState}. Proceeding to create new connection setup.`,
      )

      existingPeerEntry.connection.close()
      if (existingPeerEntry.dataChannel) {
        existingPeerEntry.dataChannel.close()
      }
      get().peerConnections.delete(peerId)
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for peer ${peerId}`)
    const peerConnection = new RTCPeerConnection(DEFAULT_PC_CONFIG)

    const newPeerEntry: PeerConnection = {
      connection: peerConnection,
      sessionId: peerId,
    }
    get().peerConnections.set(peerId, newPeerEntry)
    set({ peerConnections: new Map(get().peerConnections) })

    peerConnection.oniceconnectionstatechange = async () => {
      console.log(`[WebRTC] ICE connection state changed for peer ${peerId}: ${peerConnection.iceConnectionState}`)

      if (peerConnection.iceConnectionState === "failed") {
        console.error(`[WebRTC] ICE connection failed for peer ${peerId}. Attempting restart...`)

        try {
          const currentTransfers = get().transfers.filter(
            (t) => t.peerId === peerId && (t.status === "transferring" || t.status === "paused"),
          )

          if (currentTransfers.length > 0) {
            currentTransfers.forEach((transfer) => {
              get().updateTransferStatus(transfer.fileId, "paused", "Connection issues - attempting to reconnect")
            })
          }

          if (peerConnection.restartIce) {
            peerConnection.restartIce()
            console.log(`[WebRTC] ICE restart initiated for peer ${peerId}`)
          } else {
            const offerOptions = { iceRestart: true }
            const offer = await peerConnection.createOffer(offerOptions)
            await peerConnection.setLocalDescription(offer)

            const socket = useSocketStore.getState().socket
            if (socket) {
              socket.emit("relay-offer", { offer, peerId })
              console.log(`[WebRTC] ICE restart offer sent to ${peerId}`)
            }
          }
        } catch (err) {
          console.error(`[WebRTC] Error during ICE restart for ${peerId}:`, err)
        }
      }

      if (["connected", "completed", "failed", "disconnected"].includes(peerConnection.iceConnectionState)) {
        try {
          const stats = await peerConnection.getStats()
          let foundSelectedPair = false
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.nominated && report.state === "succeeded") {
              const local = stats.get(report.localCandidateId)
              const remote = stats.get(report.remoteCandidateId)
              console.log(`[WebRTC] Stats: Active Candidate Pair for ${peerId} (ID: ${report.id}):
  Local: ${local?.address}:${local?.port} (${local?.candidateType}, ${local?.protocol})
  Remote: ${remote?.address}:${remote?.port} (${remote?.candidateType}, ${remote?.protocol})
  RTT: ${report.currentRoundTripTime}s, State: ${report.state}`)
              foundSelectedPair = true
            }
          })
          if (!foundSelectedPair) {
            stats.forEach((report) => {
              if (report.type === "transport" && report.selectedCandidatePairId) {
                const selectedPair = stats.get(report.selectedCandidatePairId)
                if (selectedPair) {
                  const localCandidate = stats.get(selectedPair.localCandidateId)
                  const remoteCandidate = stats.get(selectedPair.remoteCandidateId)
                  console.log(`[WebRTC] Stats: Transport Selected Candidate Pair ID ${report.selectedCandidatePairId} for ${peerId}:
  Local: ${localCandidate?.address}:${localCandidate?.port} (${localCandidate?.candidateType}, ${localCandidate?.protocol})
  Remote: ${remoteCandidate?.address}:${remoteCandidate?.port} (${remoteCandidate?.candidateType}, ${remoteCandidate?.protocol})
  Pair State: ${selectedPair.state}`)
                }
              }
            })
          }
        } catch (err) {
          console.error(`[WebRTC] Error getting stats for ${peerId}:`, err)
        }
      }
    }

    peerConnection.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state changed for peer ${peerId}: ${peerConnection.signalingState}`)
    }

    peerConnection.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state changed for peer ${peerId}: ${peerConnection.iceGatheringState}`)
    }

    peerConnection.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
      console.error(
        `[WebRTC] ICE candidate error for peer ${peerId}: ` +
          `Address: ${event.address}, Port: ${event.port}, URL: ${event.url}, ` +
          `Error Code: ${event.errorCode}, Error Text: ${event.errorText}`,
      )
    }

    peerConnection.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state changed for peer ${peerId}: ${peerConnection.connectionState}`)
    }

    const dataChannel = peerConnection.createDataChannel("fileTransfer", {
      ordered: true,
      maxRetransmits: 30,
      negotiated: false,
      id: 0,
      protocol: "file-transfer",
    })

    dataChannel.bufferedAmountLowThreshold = 65536 * 8
    dataChannel.binaryType = "arraybuffer"

    let connectionTimeoutId: number | undefined
    connectionTimeoutId = window.setTimeout(() => {
      if (peerConnection.iceConnectionState !== "connected" && peerConnection.iceConnectionState !== "completed") {
        console.warn(`[WebRTC] Connection to peer ${peerId} timed out. Attempting relay fallback.`)

        if (connectionTimeoutId) {
          window.clearTimeout(connectionTimeoutId)
          connectionTimeoutId = undefined
        }

        get().retryConnectionWithRelay(peerId)
      }
    }, 15000)

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state changed for peer ${peerId}: ${peerConnection.iceConnectionState}`)

      if (peerConnection.iceConnectionState === "connected" || peerConnection.iceConnectionState === "completed") {
        if (connectionTimeoutId) {
          window.clearTimeout(connectionTimeoutId)
          connectionTimeoutId = undefined
        }
      }
    }

    dataChannel.onopen = () => {
      console.log(`[WebRTC] Data channel opened with peer ${peerId}`)
    }

    dataChannel.onclose = () => {
      console.log(`[WebRTC] Data channel closed with peer ${peerId}`)
    }

    dataChannel.onerror = (event) => {
      console.error(`[WebRTC] Data channel error with peer ${peerId}:`, event)

      const activeTransfers = get().transfers.filter(
        (t) => t.peerId === peerId && (t.status === "transferring" || t.status === "paused"),
      )

      activeTransfers.forEach((transfer) => {
        get().updateTransferStatus(transfer.fileId, "error", "Connection error")
      })
    }

    let pendingChunkMetadata: { fileId: string; chunkIndex: number; totalChunks: number } | null = null

    dataChannel.onmessage = async (event) => {
      if (typeof event.data === "string") {
        console.log(`[WebRTC] Received string message from ${peerId}`)
        try {
          const message = JSON.parse(event.data)

          if (message.type === "file-offer") {
            const { fileId, fileName, fileSize, fileType } = message.data

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

            const navigate = get().navigate
            if (navigate && window.location.pathname !== "/transfer") {
              navigate("/transfer")
            }

            dataChannel.send(
              JSON.stringify({
                type: "file-offer-ack",
                data: { fileId },
              }),
            )
          } else if (message.type === "file-accepted") {
            const { fileId: acceptedFileId } = message.data
            const acceptance = get().pendingFileAcceptances.get(acceptedFileId)
            if (acceptance) {
              console.log(`[WebRTC] Received file-accepted for ${acceptedFileId}`)
              acceptance.resolve(true)
              get().pendingFileAcceptances.delete(acceptedFileId)

              get().updateTransferStatus(acceptedFileId, "transferring")

              const transfers = get().transfers
              const transferIndex = transfers.findIndex((t) => t.fileId === acceptedFileId)
              if (transferIndex !== -1) {
                const updatedTransfers = [...transfers]
                updatedTransfers[transferIndex].startTime = Date.now()
                set({ transfers: updatedTransfers })
              }
            }
          } else if (message.type === "file-rejected") {
            const { fileId: rejectedFileId } = message.data
            const acceptance = get().pendingFileAcceptances.get(rejectedFileId)
            if (acceptance) {
              console.log(`[WebRTC] Received file-rejected for ${rejectedFileId}`)
              acceptance.reject(new Error("File transfer rejected by peer"))
              get().pendingFileAcceptances.delete(rejectedFileId)
              get().updateTransferStatus(rejectedFileId, "error", "Rejected by peer")
            }
          } else if (message.type === "file-complete-notify") {
            const { fileId } = message.data
            const transfer = get().transfers.find((t) => t.fileId === fileId)
            if (transfer && transfer.status !== "completed") {
              const verifyComplete = async () => {
                const currentTransfer = get().transfers.find((t) => t.fileId === fileId)
                if (!currentTransfer) return false

                const allChunksAccountedFor = currentTransfer.chunks.receivedIndices
                  ? currentTransfer.chunks.receivedIndices.size === currentTransfer.chunks.total
                  : currentTransfer.chunks.received === currentTransfer.chunks.total

                if (allChunksAccountedFor) {
                  if (currentTransfer.usesFileSystemAccessAPI && currentTransfer.writableStream) {
                    try {
                      await currentTransfer.writableStream.close()
                      currentTransfer.writableStream = undefined
                      console.log(`[WebRTC] File ${currentTransfer.fileName} fully written to disk`)
                    } catch (err) {
                      console.error(`[WebRTC] Error finalizing file:`, err)
                      return false
                    }
                  }
                  return true
                }
                return false
              }

              const isComplete = await verifyComplete()
              if (isComplete) {
                get().updateTransferStatus(fileId, "completed")

                dataChannel.send(
                  JSON.stringify({
                    type: "file-complete-confirm",
                    data: { fileId },
                  }),
                )
              } else {
                console.warn(
                  `[WebRTC] Received complete-notify for ${fileId} but verification failed. Expected: ${
                    transfer.chunks.total
                  }, Received (via indices): ${transfer.chunks.receivedIndices?.size || "N/A"}, Received (via count): ${
                    transfer.chunks.received
                  }`,
                )

                const missingChunks: number[] = []
                if (transfer.chunks.receivedIndices) {
                  for (let i = 0; i < transfer.chunks.total; i++) {
                    if (!transfer.chunks.receivedIndices.has(i)) {
                      missingChunks.push(i)
                    }
                  }
                } else {
                  console.warn(
                    `[WebRTC] Missing chunk calculation fallback for ${fileId} as receivedIndices is not available.`,
                  )
                  for (let i = transfer.chunks.received; i < transfer.chunks.total; i++) {
                    missingChunks.push(i)
                  }
                }

                if (missingChunks.length > 0) {
                  dataChannel.send(
                    JSON.stringify({
                      type: "chunk-resend-request",
                      data: {
                        fileId,
                        missingChunks,
                      },
                    }),
                  )
                } else {
                  console.error(
                    `[WebRTC] Verification failed for ${fileId}, but no missing chunks identified. This might be an issue.`,
                  )
                }
              }
            }
          } else if (message.type === "file-chunk-meta") {
            console.log(`[WebRTC] Received chunk-meta from ${peerId}:`, message.data)
            pendingChunkMetadata = message.data
          } else if (message.type === "file-complete-confirm") {
            const { fileId: confirmedFileId } = message.data
            console.log(
              `[WebRTC] Sender received file-complete-confirm for ${confirmedFileId}. File is fully received and assembled by peer.`,
            )
            get().updateTransferStatus(confirmedFileId, "completed")

            // Notify the user that the transfer is complete
            const transfer = get().transfers.find((t) => t.fileId === confirmedFileId)
            if (transfer && !transfer._notified) {
              // Mark as notified to prevent duplicate notifications
              const updatedTransfers = get().transfers.map((t) =>
                t.fileId === confirmedFileId ? { ...t, _notified: true } : t,
              )
              set({ transfers: updatedTransfers })

              // You could add a notification here if needed
              console.log(
                `[WebRTC] Transfer of ${transfer.fileName} to ${transfer.peerId} is complete and confirmed by receiver`,
              )
            }
          } else if (message.type === "transfer-control") {
            const { fileId, action } = message.data

            if (action === "pause") {
              get().updateTransferStatus(fileId, "paused")
            } else if (action === "resume") {
              get().updateTransferStatus(fileId, "transferring")
            } else if (action === "cancel") {
              get().updateTransferStatus(fileId, "error", "Transfer cancelled by peer")
            }
          } else if (message.type === "chunk-resend-request") {
            const { fileId, missingChunks } = message.data
            const transfer = get().transfers.find((t) => t.fileId === fileId)
            if (!transfer || transfer.direction !== "outgoing") {
              console.warn(`[WebRTC] Invalid chunk resend request for ${fileId}`)
              return
            }

            console.log(`[WebRTC] Resending chunks ${missingChunks.join(",")} for ${fileId}`)
            const file = get().selectedFiles.find((f) => f.name === transfer.fileName)
            if (!file) {
              console.error(`[WebRTC] Original file not found for resend: ${transfer.fileName}`)
              return
            }

            const { chunkSize } = useSettingsStore.getState()

            const resendChunks = async () => {
              for (const chunkIndex of missingChunks) {
                if (dataChannel.readyState !== "open") {
                  console.error(`[WebRTC] Data channel closed during chunk resend for ${fileId}`)
                  break
                }

                while (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
                  console.log(
                    `[WebRTC] Buffered amount ${dataChannel.bufferedAmount} exceeds threshold during resend. Waiting...`,
                  )
                  await new Promise((resolve) => {
                    dataChannel.onbufferedamountlow = resolve
                  })
                }

                try {
                  const start = chunkIndex * chunkSize
                  const end = Math.min(start + chunkSize, file.size)
                  const chunk = file.slice(start, end)

                  const chunkArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
                    reader.onerror = reject
                    reader.readAsArrayBuffer(chunk)
                  })

                  dataChannel.send(
                    JSON.stringify({
                      type: "file-chunk-meta",
                      data: {
                        fileId,
                        chunkIndex,
                        totalChunks: transfer.chunks.total,
                      },
                    }),
                  )

                  const bufferCopy = chunkArrayBuffer.slice(0)
                  dataChannel.send(bufferCopy)

                  console.log(`[WebRTC] Resent chunk ${chunkIndex + 1}/${transfer.chunks.total} for ${fileId}`)

                  await new Promise((resolve) => setTimeout(resolve, 50))
                } catch (error) {
                  console.error(`[WebRTC] Error resending chunk ${chunkIndex} for ${fileId}:`, error)
                }
              }
            }

            resendChunks().catch((err) => {
              console.error(`[WebRTC] Failed to resend chunks for ${fileId}:`, err)
            })
          }
        } catch (error) {
          console.error("[WebRTC] Error processing string message:", error, event.data)
        }
      } else if (event.data instanceof ArrayBuffer) {
        const connection = get().peerConnections.get(peerId)
        if (!connection || !connection.dataChannel || connection.dataChannel.readyState !== "open") {
          console.error(`[WebRTC] Received ArrayBuffer but data channel is not open for ${peerId}`)
          return
        }

        console.log(`[WebRTC] Received ArrayBuffer (chunk data) from ${peerId}`)
        if (!pendingChunkMetadata) {
          console.error("[WebRTC] Received ArrayBuffer chunk without prior metadata. Discarding.")
          return
        }

        const { fileId, chunkIndex, totalChunks } = pendingChunkMetadata
        pendingChunkMetadata = null

        try {
          const receivedData = event.data.slice(0)

          const plainChunk = new Uint8Array(receivedData)
          if (plainChunk.byteLength === 0) {
            console.error("[WebRTC] Received empty ArrayBuffer chunk")
            throw new Error("Empty chunk received")
          }

          const transfers = get().transfers
          const transferIndex = transfers.findIndex((t) => t.fileId === fileId && t.direction === "incoming")

          if (transferIndex === -1) {
            console.warn(`[WebRTC] Received chunk for unknown transfer (after metadata): ${fileId}`)
            if (connection.dataChannel.readyState === "open") {
              connection.dataChannel.send(JSON.stringify({ type: "chunk-ack", data: { fileId, chunkIndex } }))
            }
            return
          }

          console.log(`[WebRTC] Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId} from peer ${peerId}`)
          const transfer = { ...transfers[transferIndex] }

          if (transfer.chunks.total !== totalChunks) {
            console.warn(
              `[WebRTC] Discrepancy detected in total chunks for ${fileId}. Receiver calculated: ${transfer.chunks.total}, Sender sent: ${totalChunks}. Updating receiver count.`,
            )
            transfer.chunks.total = totalChunks

            if (transfer.chunks.data && transfer.chunks.data.length < totalChunks) {
              const newData = new Array(totalChunks).fill(null)
              transfer.chunks.data.forEach((chunk, idx) => {
                if (idx < totalChunks) {
                  newData[idx] = chunk
                }
              })
              transfer.chunks.data = newData
            }
          }

          if (transfer.status === "error") {
            console.log(`[WebRTC] Ignoring chunk for already errored/cancelled transfer ${fileId}`)
            dataChannel.send(JSON.stringify({ type: "chunk-ack", data: { fileId, chunkIndex } }))
            return
          }

          if (transfer.status === "pending") {
            transfer.status = "transferring"
            transfer.startTime = Date.now()
          }

          if (transfer.usesFileSystemAccessAPI && transfer.writableStream) {
            try {
              await transfer.writableStream.write(plainChunk)
              console.log(
                `[WebRTC] Chunk ${chunkIndex + 1} written to disk via File System Access API for ${transfer.fileName}`,
              )
            } catch (err: any) {
              console.error(`[WebRTC] Error writing chunk to disk for ${transfer.fileName}:`, err.message)
              transfer.status = "error"
              transfer.error = "Disk write error"

              if (transfer.writableStream) {
                try {
                  await transfer.writableStream.close()
                } catch (closeErr) {}
              }
              transfer.writableStream = undefined
            }
          } else {
            if (!transfer.chunks.data) {
              transfer.chunks.data = new Array(totalChunks).fill(null)
            }
            if (!transfer.chunks.receivedIndices) {
              transfer.chunks.receivedIndices = new Set<number>()
            }

            transfer.chunks.data[chunkIndex] = plainChunk
            transfer.chunks.receivedIndices.add(chunkIndex)
          }

          if (transfer.chunks.receivedIndices) {
            transfer.chunks.received = transfer.chunks.receivedIndices.size
          } else {
            transfer.chunks.received = (transfer.chunks.received || 0) + 1
          }

          const now = Date.now()
          const elapsedTime = (now - (transfer.startTime || now)) / 1000

          // Use the new calculateProgress function for more accurate progress
          const progress = calculateProgress(transfer.chunks.received, transfer.chunks.total)

          // Calculate bytes received based on progress
          const bytesReceived = progress * transfer.fileSize

          // Calculate speed with safeguards against division by zero
          const speed = elapsedTime > 0.1 ? bytesReceived / elapsedTime : 0

          // Calculate remaining bytes and ETA
          const remainingBytes = transfer.fileSize - bytesReceived
          const eta = speed > 1000 ? remainingBytes / speed : 0 // Only calculate ETA if speed is meaningful

          // Update transfer with calculated values
          transfer.progress = progress
          transfer.speed = speed
          transfer.eta = eta

          if (connection.dataChannel.readyState === "open") {
            connection.dataChannel.send(JSON.stringify({ type: "chunk-ack", data: { fileId, chunkIndex } }))
          }

          let finalStatus = transfer.status
          if (transfer.chunks.received === transfer.chunks.total && transfer.status !== "error") {
            if (transfer.usesFileSystemAccessAPI && transfer.writableStream) {
              try {
                await transfer.writableStream.close()
                console.log(`[WebRTC] File ${transfer.fileName} (${fileId}) fully written to disk and stream closed.`)
                finalStatus = "completed"
                transfer.writableStream = undefined
              } catch (err: any) {
                console.error(`[WebRTC] Error closing writable stream for ${transfer.fileName}:`, err.message)
                transfer.error = "Error finalizing file on disk"
                finalStatus = "error"
              }
            } else if (!transfer.usesFileSystemAccessAPI) {
              // More robust Blob assembly with better error handling and recovery
              try {
                console.log(`[WebRTC] Attempting to assemble file ${fileId} from chunks...`)

                // First check if we have all the chunks
                if (!transfer.chunks.data || transfer.chunks.data.length !== transfer.chunks.total) {
                  console.error(
                    `[WebRTC] Chunk data array length mismatch: ${transfer.chunks.data?.length} vs expected ${transfer.chunks.total}`,
                  )

                  // Try to resize the array if needed
                  if (transfer.chunks.data && transfer.chunks.data.length < transfer.chunks.total) {
                    console.log(
                      `[WebRTC] Resizing chunk data array from ${transfer.chunks.data.length} to ${transfer.chunks.total}`,
                    )
                    const newData = new Array(transfer.chunks.total).fill(null)
                    transfer.chunks.data.forEach((chunk, idx) => {
                      if (idx < transfer.chunks.total) {
                        newData[idx] = chunk
                      }
                    })
                    transfer.chunks.data = newData
                  } else if (!transfer.chunks.data) {
                    console.log(`[WebRTC] Creating new chunk data array of size ${transfer.chunks.total}`)
                    transfer.chunks.data = new Array(transfer.chunks.total).fill(null)
                  }
                }

                // Check for missing chunks
                const missingChunks: number[] = []
                if (transfer.chunks.receivedIndices) {
                  for (let i = 0; i < transfer.chunks.total; i++) {
                    if (!transfer.chunks.receivedIndices.has(i)) {
                      missingChunks.push(i)
                    }
                  }
                } else {
                  // If receivedIndices is not available, check the data array
                  for (let i = 0; i < transfer.chunks.total; i++) {
                    if (
                      !transfer.chunks.data ||
                      !transfer.chunks.data[i] ||
                      !(transfer.chunks.data[i] instanceof Uint8Array)
                    ) {
                      missingChunks.push(i)
                    }
                  }
                }

                if (missingChunks.length > 0) {
                  console.warn(
                    `[WebRTC] Missing ${missingChunks.length} chunks: ${missingChunks.slice(0, 10).join(", ")}${
                      missingChunks.length > 10 ? "..." : ""
                    }`,
                  )

                  // Request missing chunks if we have a connection
                  const connection = get().peerConnections.get(transfer.peerId)
                  if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
                    // Only request a batch of chunks at a time to avoid overwhelming the connection
                    const chunksToRequest = missingChunks.slice(0, 100)
                    console.log(`[WebRTC] Requesting resend of ${chunksToRequest.length} missing chunks`)

                    connection.dataChannel.send(
                      JSON.stringify({
                        type: "chunk-resend-request",
                        data: {
                          fileId,
                          missingChunks: chunksToRequest,
                        },
                      }),
                    )

                    // Keep status as transferring
                    finalStatus = "transferring"
                    return
                  } else {
                    console.error(`[WebRTC] Cannot request missing chunks: data channel not available`)
                    finalStatus = "error"
                    transfer.error = "Connection lost - missing chunks cannot be requested"
                    return
                  }
                }

                // If we get here, we should have all chunks - try to assemble them
                // Filter out null values and ensure we only have valid Uint8Array objects
                const validChunks = transfer.chunks.data!.filter(
                  (chunk): chunk is Uint8Array => chunk !== null && chunk instanceof Uint8Array && chunk.byteLength > 0,
                )

                if (validChunks.length !== transfer.chunks.total) {
                  console.error(
                    `[WebRTC] Valid chunks count (${validChunks.length}) doesn't match expected total (${transfer.chunks.total})`,
                  )

                  // If we have most of the chunks, try to assemble anyway
                  if (validChunks.length >= transfer.chunks.total * 0.99) {
                    console.log(
                      `[WebRTC] Attempting to assemble file with ${validChunks.length}/${
                        transfer.chunks.total
                      } chunks (${((validChunks.length / transfer.chunks.total) * 100).toFixed(2)}%)`,
                    )
                  } else {
                    finalStatus = "error"
                    transfer.error = `Missing ${transfer.chunks.total - validChunks.length} chunks for assembly`
                    return
                  }
                }

                // Create the blob from valid chunks
                const fileBlob = new Blob(validChunks, { type: transfer.fileType })
                transfer.fileBlob = fileBlob

                console.log(
                  `[WebRTC] File ${transfer.fileName} (${fileId}) assembled. Blob size: ${fileBlob.size}, Expected size: ${transfer.fileSize}`,
                )

                // Check if the size is within tolerance
                const sizeDifference = Math.abs(fileBlob.size - transfer.fileSize)
                const sizeTolerancePercent = (sizeDifference / transfer.fileSize) * 100

                if (sizeTolerancePercent > 1.0) {
                  // More generous tolerance (1% instead of 0.1%)
                  console.error(
                    `[WebRTC] Assembled Blob size mismatch for ${fileId}! Blob: ${fileBlob.size}, Expected: ${
                      transfer.fileSize
                    }, Difference: ${sizeDifference} bytes (${sizeTolerancePercent.toFixed(4)}%)`,
                  )

                  // If the difference is too large, request all chunks again
                  const connection = get().peerConnections.get(transfer.peerId)
                  if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
                    // Request a full retransmission
                    console.log(`[WebRTC] Size mismatch too large, requesting full retransmission`)

                    // Clear existing data and request all chunks
                    transfer.chunks.data = new Array(transfer.chunks.total).fill(null)
                    transfer.chunks.receivedIndices = new Set<number>()
                    transfer.chunks.received = 0

                    const allChunks = Array.from({ length: transfer.chunks.total }, (_, i) => i)

                    // Request in batches of 100
                    const firstBatch = allChunks.slice(0, 100)
                    connection.dataChannel.send(
                      JSON.stringify({
                        type: "chunk-resend-request",
                        data: {
                          fileId,
                          missingChunks: firstBatch,
                        },
                      }),
                    )

                    finalStatus = "transferring"
                    return
                  } else {
                    finalStatus = "error"
                    transfer.error = "Size mismatch and connection lost"
                    return
                  }
                } else {
                  console.log(
                    `[WebRTC] File ${transfer.fileName} (${fileId}) fully received and assembled into a Blob. Sizes match within tolerance.`,
                  )
                  finalStatus = "completed"
                }
              } catch (error) {
                console.error(`[WebRTC] Error during Blob assembly:`, error)
                finalStatus = "error"
                transfer.error = `Assembly error: ${(error as any).message || "Unknown error"}`
              }
            }
          }

          const updatedTransfersArray = get().transfers.map((t, idx) => (idx === transferIndex ? transfer : t))
          set({ transfers: updatedTransfersArray })

          if (finalStatus !== transfer.status) {
            get().updateTransferStatus(fileId, finalStatus, transfer.error)

            if (finalStatus === "completed") {
              console.log(
                `[WebRTC] Receiver: File ${fileId} now complete after chunk processing. Sending file-complete-confirm.`,
              )
              dataChannel.send(
                JSON.stringify({
                  type: "file-complete-confirm",
                  data: { fileId },
                }),
              )
            }
          }
        } catch (error) {
          console.error(`[WebRTC] Error processing chunk ${chunkIndex + 1}/${totalChunks} for ${fileId}:`, error)
          get().updateTransferStatus(
            fileId,
            "error",
            `Chunk processing error: ${(error as any).message || "Unknown error"}`,
          )
        } finally {
          if (connection.dataChannel.readyState === "open") {
            connection.dataChannel.send(
              JSON.stringify({
                type: "chunk-ack",
                data: { fileId, chunkIndex },
              }),
            )
          }
        }
      } else {
        console.warn("[WebRTC] Received unknown message type on data channel:", event.data)
      }
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Generated ICE candidate for peer ${peerId}:`, event.candidate)

        socket.emit("relay-ice-candidate", {
          candidate: event.candidate,
          peerId,
        })
      }
    }

    peerConnection.ondatachannel = (event) => {
      console.log(`[WebRTC] Incoming data channel event from peer ${peerId}`)
      const incomingDataChannel = event.channel
      incomingDataChannel.binaryType = "arraybuffer"
      console.log(`[WebRTC] Incoming data channel "${incomingDataChannel.label}" received.`)

      incomingDataChannel.onopen = () => {
        console.log(`[WebRTC] Incoming data channel with ${peerId} opened.`)
      }

      incomingDataChannel.onclose = () => {
        console.log(`[WebRTC] Incoming data channel with ${peerId} closed.`)
      }

      incomingDataChannel.onmessage = async (ev) => {
        console.log(`[WebRTC] Message on incoming data channel from ${peerId}`)

        if (dataChannel.onmessage) {
          dataChannel.onmessage(ev)
        }
      }

      const connections = get().peerConnections
      const connection = connections.get(peerId)

      if (connection) {
        connection.dataChannel = incomingDataChannel
        connections.set(peerId, connection)
        set({ peerConnections: new Map(connections) })
      }
    }

    const currentEntry = get().peerConnections.get(peerId)
    if (currentEntry && currentEntry.connection === peerConnection) {
      currentEntry.dataChannel = dataChannel
      get().peerConnections.set(peerId, currentEntry)
      set({ peerConnections: new Map(get().peerConnections) })
    } else {
      console.error(`[WebRTC] Mismatch or missing peer entry when trying to set dataChannel for ${peerId}`)

      get().peerConnections.set(peerId, {
        connection: peerConnection,
        dataChannel,
        sessionId: peerId,
      })
      set({ peerConnections: new Map(get().peerConnections) })
    }

    if (!isAnsweringOffer && peerConnection.signalingState === "stable") {
      console.log(`[WebRTC] Creating offer for peer ${peerId} as initiator.`)
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      console.log(`[WebRTC] Sending offer to ${peerId}.`)
      socket.emit("relay-offer", { offer, peerId })
    } else {
      console.log(`[WebRTC] Not creating offer for ${peerId}, signalingState is ${peerConnection.signalingState}.`)
    }
  },

  closePeerConnection: (peerId: string) => {
    console.log(`[WebRTC] closePeerConnection called for ${peerId}`)
    const connections = get().peerConnections
    const connection = connections.get(peerId)

    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close()
      }

      connection.connection.close()
      connections.delete(peerId)

      set({ peerConnections: new Map(connections) })
    }
  },

  setSelectedFiles: (files: File[]) => {
    set({ selectedFiles: files })
  },

  sendFiles: async (peerId: string) => {
    console.log(`[WebRTC] sendFiles called for peerId: ${peerId}`)
    const { peerConnections, selectedFiles } = get()
    const connection = peerConnections.get(peerId)

    if (!connection) {
      console.error(`[WebRTC] No peer connection found for peerId: ${peerId} in sendFiles.`)
      return
    }
    if (!connection.dataChannel) {
      console.error(`[WebRTC] No data channel on connection for peerId: ${peerId} in sendFiles.`)
      return
    }

    console.log(`[WebRTC] Data channel state for ${peerId} before sending: ${connection.dataChannel.readyState}`)

    const isDataChannelNotOpen =
      connection.dataChannel.readyState === "connecting" ||
      connection.dataChannel.readyState === "closing" ||
      connection.dataChannel.readyState === "closed"

    if (isDataChannelNotOpen) {
      console.error(
        `[WebRTC] Data channel for ${peerId} is not open. State: ${connection.dataChannel.readyState}. Attempting to wait...`,
      )

      for (let i = 0; i < 10; i++) {
        if (connection.dataChannel.readyState === "open") {
          console.log(`[WebRTC] Data channel for ${peerId} opened after waiting.`)
          break
        }
        console.log(`[WebRTC] Waiting for data channel to open for ${peerId}... (${i + 1})`)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      const isStillNotOpen =
        connection.dataChannel.readyState === "connecting" ||
        connection.dataChannel.readyState === "closing" ||
        connection.dataChannel.readyState === "closed"
      if (isStillNotOpen) {
        console.error(`[WebRTC] Data channel for ${peerId} did not open after waiting. Aborting sendFiles.`)
        return
      }
    }

    const { dataChannel } = connection
    const { chunkSize, useCompression } = useSettingsStore.getState()

    for (const file of selectedFiles) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      let currentFileIdForCatch = fileId

      try {
        currentFileIdForCatch = fileId

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

        console.log(`[WebRTC] Sending file offer for ${file.name} to ${peerId}`)
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

        console.log(`[WebRTC] Waiting for acceptance of file ${file.name} (${fileId}) from ${peerId}`)
        try {
          await new Promise((resolve, reject) => {
            get().pendingFileAcceptances.set(fileId, { resolve, reject })

            setTimeout(() => {
              if (get().pendingFileAcceptances.has(fileId)) {
                get().pendingFileAcceptances.delete(fileId)
                reject(new Error("File offer acceptance timeout"))
                get().updateTransferStatus(fileId, "error", "Acceptance timeout")
              }
            }, 30000)
          })
          console.log(`[WebRTC] File offer for ${file.name} (${fileId}) accepted by ${peerId}. Starting transfer.`)
        } catch (error: any) {
          console.error(
            `[WebRTC] File offer for ${file.name} (${fileId}) was not accepted or timed out:`,
            error.message,
          )
          get().updateTransferStatus(fileId, "error", error.message || "Offer not accepted")
          continue
        }

        const totalChunks = Math.ceil(file.size / chunkSize)
        console.log(`[WebRTC] Starting to send ${totalChunks} chunks for file ${file.name} to ${peerId}`)

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          while (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
            console.log(
              `[WebRTC] Buffered amount ${dataChannel.bufferedAmount} exceeds threshold ${dataChannel.bufferedAmountLowThreshold}. Waiting...`,
            )
            await new Promise((resolve) => {
              dataChannel.onbufferedamountlow = resolve
            })
          }

          const currentTransfers = get().transfers
          const currentTransfer = currentTransfers.find((t) => t.fileId === fileId)

          if (!currentTransfer || currentTransfer.status === "error") {
            console.log(`[WebRTC] Transfer ${fileId} cancelled or errored. Stopping chunk sending.`)
            break
          }

          if (currentTransfer.status === "paused") {
            console.log(`[WebRTC] Transfer ${fileId} is paused. Waiting for resume.`)
            await new Promise<void>((resolveLoop) => {
              const checkStatus = () => {
                const updatedTransfer = get().transfers.find((t) => t.fileId === fileId)
                if (updatedTransfer && updatedTransfer.status === "transferring") {
                  console.log(`[WebRTC] Transfer ${fileId} resumed.`)
                  resolveLoop()
                } else if (updatedTransfer && updatedTransfer.status === "error") {
                  console.log(`[WebRTC] Transfer ${fileId} errored while paused.`)
                  resolveLoop()
                } else {
                  setTimeout(checkStatus, 500)
                }
              }
              checkStatus()
            })

            const afterPauseTransfer = get().transfers.find((t) => t.fileId === fileId)
            if (!afterPauseTransfer || afterPauseTransfer.status === "error") {
              console.log(`[WebRTC] Transfer ${fileId} errored after pause. Stopping chunk sending.`)
              break
            }
          }

          console.log(`[WebRTC] Preparing chunk ${chunkIndex + 1}/${totalChunks} for ${file.name}`)

          const start = chunkIndex * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const chunk = file.slice(start, end)

          const chunkArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
            reader.onerror = reject
            reader.readAsArrayBuffer(chunk)
          })

          dataChannel.send(
            JSON.stringify({
              type: "file-chunk-meta",
              data: {
                fileId,
                chunkIndex,
                totalChunks,
              },
            }),
          )

          const bufferCopy = chunkArrayBuffer.slice(0)
          dataChannel.send(bufferCopy)

          const progress = (chunkIndex + 1) / totalChunks

          const now = Date.now()
          const transfer = get().transfers.find((t) => t.fileId === fileId)
          const elapsedTime = transfer?.startTime ? (now - transfer.startTime) / 1000 : 0
          const speed = elapsedTime > 0 ? (file.size * progress) / elapsedTime : 0
          const remainingBytes = file.size * (1 - progress)
          const eta = speed > 0 ? remainingBytes / speed : 0

          get().updateTransferProgress(fileId, progress, speed, eta)

          console.log(`[WebRTC] Chunk ${chunkIndex + 1} sent. Buffered amount: ${dataChannel.bufferedAmount}`)
        }

        const finalTransferState = get().transfers.find((t) => t.fileId === fileId)
        if (finalTransferState && finalTransferState.status !== "error") {
          await new Promise<void>((resolve) => {
            const checkBuffer = () => {
              const currentTransfer = get().transfers.find((t) => t.fileId === fileId)

              if (!currentTransfer || currentTransfer.status === "error") {
                console.log(`[WebRTC] Transfer ${fileId} errored while waiting for buffer to drain.`)
                resolve()
                return
              }

              if (dataChannel.bufferedAmount <= 0) {
                console.log(`[WebRTC] Buffer drained for ${fileId}.`)
                resolve()
              } else {
                console.log(
                  `[WebRTC] Waiting for buffer to drain for ${fileId}. Buffered: ${dataChannel.bufferedAmount}`,
                )

                const timeoutId = setTimeout(() => {
                  dataChannel.onbufferedamountlow = null
                  checkBuffer()
                }, 100)

                dataChannel.onbufferedamountlow = () => {
                  console.log(
                    `[WebRTC] onbufferedamountlow triggered for ${fileId}. Buffered: ${dataChannel.bufferedAmount}`,
                  )
                  clearTimeout(timeoutId)
                  dataChannel.onbufferedamountlow = null

                  checkBuffer()
                }
              }
            }
            checkBuffer()
          })

          const verifiedTransfer = get().transfers.find((t) => t.fileId === fileId)
          if (verifiedTransfer && verifiedTransfer.status !== "error") {
            console.log(`[WebRTC] All ${verifiedTransfer.chunks.total} chunks sent and buffer drained for ${fileId}.`)

            console.log(`[WebRTC] Sending file-complete-notify for ${fileId} to ${peerId}`)
            dataChannel.send(
              JSON.stringify({
                type: "file-complete-notify",
                data: { fileId },
              }),
            )

            await new Promise<void>((resolve) => {
              const checkComplete = () => {
                const updatedTransfer = get().transfers.find((t) => t.fileId === fileId)
                if (updatedTransfer?.status === "completed") {
                  resolve()
                } else if (updatedTransfer?.status === "error") {
                  resolve()
                } else {
                  setTimeout(checkComplete, 500)
                }
              }
              checkComplete()
            })
          } else {
            console.error(
              `[WebRTC] Failed to verify transfer ${fileId} - sent: ${verifiedTransfer?.chunks.received}/${verifiedTransfer?.chunks.total}, status: ${verifiedTransfer?.status}`,
            )
            get().updateTransferStatus(fileId, "error", "Transfer verification failed")
          }
        } else {
          console.log(
            `[WebRTC] Transfer ${fileId} ended with status ${finalTransferState?.status}. Not sending complete-notify.`,
          )
        }
      } catch (error: any) {
        console.error(
          `[WebRTC] Unhandled error processing file ${file.name} (${currentFileIdForCatch}):`,
          error.message,
          error,
        )
        get().updateTransferStatus(
          currentFileIdForCatch,
          "error",
          `Critical error during transfer: ${error.message || "Unknown error"}`,
        )
      }
    }

    set({ selectedFiles: [] })
  },

  handleRelayOffer: async (offer, fromPeerId) => {
    console.log(`[WebRTC] handleRelayOffer from ${fromPeerId}`)
    let pc = get().peerConnections.get(fromPeerId)?.connection
    const socket = useSocketStore.getState().socket

    if (!socket) {
      console.error("[WebRTC] No socket in handleRelayOffer")
      return
    }

    if (!pc) {
      console.log(
        `[WebRTC] No existing PC for ${fromPeerId}, creating one to handle offer by calling createPeerConnection with isAnsweringOffer=true.`,
      )
      await get().createPeerConnection(fromPeerId, true)
      pc = get().peerConnections.get(fromPeerId)?.connection
      if (!pc) {
        console.error(`[WebRTC] Failed to create PC for ${fromPeerId} in handleRelayOffer`)
        return
      }
    } else if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
      const mySessionId = useSocketStore.getState().sessionId
      if (mySessionId && mySessionId < fromPeerId) {
        console.warn(
          `[WebRTC] Glare in handleRelayOffer: I (${mySessionId}) sent an offer to ${fromPeerId} and they also sent one. My ID is smaller, I expect them to handle my offer. Ignoring their offer.`,
        )
        return
      }
      console.warn(
        `[WebRTC] Glare in handleRelayOffer: I (${mySessionId}) sent an offer to ${fromPeerId} and they also sent one. My ID is larger/equal, I will process their offer.`,
      )
    }

    try {
      console.log(
        `[WebRTC] Setting remote description for offer from ${fromPeerId}. Current signaling state: ${pc.signalingState}`,
      )
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await get().processQueuedIceCandidates(fromPeerId)

      console.log(`[WebRTC] Creating answer for ${fromPeerId}. Current signaling state: ${pc.signalingState}`)
      const answer = await pc.createAnswer()
      console.log(`[WebRTC] Setting local description for answer to ${fromPeerId}.`)
      await pc.setLocalDescription(answer)

      console.log(`[WebRTC] Sending answer to ${fromPeerId}`)
      socket.emit("relay-answer", { answer, peerId: fromPeerId })
    } catch (error) {
      console.error(`[WebRTC] Error in handleRelayOffer for ${fromPeerId}:`, error)
    }
  },

  handleRelayAnswer: async (answer, fromPeerId) => {
    console.log(`[WebRTC] handleRelayAnswer from ${fromPeerId}`)
    const pc = get().peerConnections.get(fromPeerId)?.connection
    if (pc && pc.signalingState === "have-local-offer") {
      try {
        console.log(`[WebRTC] Setting remote description for answer from ${fromPeerId}`)
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await get().processQueuedIceCandidates(fromPeerId)
      } catch (error) {
        console.error(`[WebRTC] Error in handleRelayAnswer for ${fromPeerId}:`, error)
      }
    } else {
      console.warn(
        `[WebRTC] Received answer from ${fromPeerId}, but no PC in correct state. State: ${pc?.signalingState}`,
      )
    }
  },

  handleRelayIceCandidate: async (candidate, fromPeerId) => {
    console.log(`[WebRTC] handleRelayIceCandidate from ${fromPeerId}`)
    const peerConnectionEntry = get().peerConnections.get(fromPeerId)
    if (!peerConnectionEntry) {
      console.warn(`[WebRTC] Received ICE candidate from ${fromPeerId}, but no PC entry found.`)
      return
    }

    const pc = peerConnectionEntry.connection

    if (!candidate || (typeof candidate === "object" && Object.keys(candidate).length === 0 && !candidate.candidate)) {
      console.log(
        `[WebRTC] Received null or truly empty ICE candidate object from ${fromPeerId}, typically signals end of candidates.`,
      )

      if (candidate && typeof candidate.candidate !== "string") {
        console.log(`[WebRTC] Received malformed ICE candidate from ${fromPeerId}, ignoring:`, candidate)
        return
      }
    }

    const candidateInstance = new RTCIceCandidate(candidate)

    if (pc.remoteDescription) {
      try {
        if (candidateInstance.candidate) {
          console.log(`[WebRTC] Remote description is set. Adding ICE candidate from ${fromPeerId}:`, candidateInstance)
          await pc.addIceCandidate(candidateInstance)
        } else {
          console.log(`[WebRTC] Received end-of-candidates signal from ${fromPeerId}.`)
        }
      } catch (error) {
        console.error(`[WebRTC] Error adding ICE candidate from ${fromPeerId}:`, error)
      }
    } else {
      console.log(`[WebRTC] Remote description not set for ${fromPeerId}. Queuing ICE candidate.`)
      if (!peerConnectionEntry.queuedIceCandidates) {
        peerConnectionEntry.queuedIceCandidates = []
      }
      peerConnectionEntry.queuedIceCandidates.push(candidateInstance)
    }
  },

  processQueuedIceCandidates: async (peerId: string) => {
    const peerConnectionEntry = get().peerConnections.get(peerId)
    if (
      peerConnectionEntry &&
      peerConnectionEntry.queuedIceCandidates &&
      peerConnectionEntry.connection.remoteDescription
    ) {
      const pc = peerConnectionEntry.connection
      console.log(
        `[WebRTC] Processing ${peerConnectionEntry.queuedIceCandidates.length} queued ICE candidates for ${peerId}`,
      )
      while (peerConnectionEntry.queuedIceCandidates.length > 0) {
        const candidate = peerConnectionEntry.queuedIceCandidates.shift()
        if (candidate) {
          try {
            if (candidate.candidate) {
              console.log(`[WebRTC] Adding queued ICE candidate for ${peerId}:`, candidate)
              await pc.addIceCandidate(candidate)
            } else {
              console.log(`[WebRTC] Ignoring empty/end-of-candidates queued ICE signal for ${peerId}.`)
            }
          } catch (error) {
            console.error(`[WebRTC] Error adding queued ICE candidate for ${peerId}:`, error)
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

      get().updateTransferStatus(transferId, "paused")

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

      get().updateTransferStatus(transferId, "transferring")

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

      get().updateTransferStatus(transferId, "error", "Transfer cancelled")

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

  acceptTransfer: async (transferId: string) => {
    const { transfers, peerConnections } = get()
    const transferIndex = transfers.findIndex(
      (t) => t.fileId === transferId && t.direction === "incoming" && t.status === "pending",
    )

    if (transferIndex === -1) {
      console.warn(`[WebRTC] acceptTransfer called for ${transferId}, but no pending incoming transfer found.`)
      return
    }

    const transferToUpdate = { ...transfers[transferIndex] }

    const hasShowSaveFilePicker = "showSaveFilePicker" in window
    const isShowSaveFilePickerFunction = typeof window.showSaveFilePicker === "function"
    console.log(
      `[WebRTC] Checking File System Access API: 'showSaveFilePicker' in window? ${hasShowSaveFilePicker}, typeof === 'function'? ${isShowSaveFilePickerFunction}`,
    )

    if (hasShowSaveFilePicker && isShowSaveFilePickerFunction) {
      console.log(`[WebRTC] 'showSaveFilePicker' IS available. Attempting to use for ${transferToUpdate.fileName}`)
      try {
        const fileExtension = transferToUpdate.fileName.split(".").pop()
        const typesConfig = fileExtension
          ? [
              {
                description: "Original file type",

                accept: {
                  [transferToUpdate.fileType && transferToUpdate.fileType.includes("/")
                    ? transferToUpdate.fileType
                    : "application/octet-stream"]: [`.${fileExtension}`],
                },
              },
            ]
          : []

        console.log(
          `[WebRTC] Calling window.showSaveFilePicker with suggestedName: ${transferToUpdate.fileName}, types:`,
          JSON.stringify(typesConfig),
        )

        const handle = await window.showSaveFilePicker({
          suggestedName: transferToUpdate.fileName,
          types: typesConfig,
        })
        console.log(`[WebRTC] showSaveFilePicker SUCCEEDED for ${transferToUpdate.fileName}. Handle:`, handle)
        transferToUpdate.fileHandle = handle
        transferToUpdate.writableStream = await handle.createWritable()
        transferToUpdate.usesFileSystemAccessAPI = true
        console.log(`[WebRTC] File handle and writable stream obtained for ${transferToUpdate.fileName}`)
      } catch (err: any) {
        console.error(
          `[WebRTC] File System Access API showSaveFilePicker FAILED or was cancelled for ${transferToUpdate.fileName}. Error name: ${err.name}, message: ${err.message}`,
          err,
        )
        if (err.name === "AbortError") {
          const updatedErrorTransfers = get().transfers.map((t) =>
            t.fileId === transferId ? ({ ...t, status: "error", error: "Save cancelled by user" } as FileTransfer) : t,
          )
          set({ transfers: updatedErrorTransfers })

          const connection = peerConnections.get(transferToUpdate.peerId)
          if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
            connection.dataChannel.send(JSON.stringify({ type: "file-rejected", data: { fileId: transferId } }))
          }
          return
        }

        transferToUpdate.usesFileSystemAccessAPI = false
      }
    } else {
      console.log(
        `[WebRTC] File System Access API not available. Falling back to Blob method for ${transferToUpdate.fileName}`,
      )
      transferToUpdate.usesFileSystemAccessAPI = false
    }

    transferToUpdate.status = "transferring"
    transferToUpdate.startTime = Date.now()

    const finalUpdatedTransfers = get().transfers.map((t) => (t.fileId === transferId ? transferToUpdate : t))
    set({ transfers: finalUpdatedTransfers })

    const connection = peerConnections.get(transferToUpdate.peerId)
    if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
      console.log(`[WebRTC] Receiver accepting file ${transferId}. Sending file-accepted to ${transferToUpdate.peerId}`)
      connection.dataChannel.send(
        JSON.stringify({
          type: "file-accepted",
          data: { fileId: transferId },
        }),
      )
    } else {
      console.error(
        `[WebRTC] Cannot send file-accepted for ${transferId}: Data channel not open or connection missing.`,
      )

      const revertedTransfers = get().transfers.map((t) =>
        t.fileId === transferId
          ? ({ ...t, status: "error", error: "Failed to send acceptance (channel issue)" } as FileTransfer)
          : t,
      )
      set({ transfers: revertedTransfers })
    }
  },

  rejectTransfer: (transferId: string) => {
    const { transfers, peerConnections } = get()
    const transferToReject = transfers.find(
      (t) => t.fileId === transferId && t.direction === "incoming" && t.status === "pending",
    )

    if (transferToReject) {
      const updatedTransfers = transfers.map((t) =>
        t.fileId === transferId ? ({ ...t, status: "error", error: "Rejected by you" } as FileTransfer) : t,
      )
      set({ transfers: updatedTransfers })

      const connection = peerConnections.get(transferToReject.peerId)
      if (connection && connection.dataChannel && connection.dataChannel.readyState === "open") {
        console.log(
          `[WebRTC] Receiver rejecting file ${transferId}. Sending file-rejected to ${transferToReject.peerId}`,
        )
        connection.dataChannel.send(
          JSON.stringify({
            type: "file-rejected",
            data: { fileId: transferId },
          }),
        )
      } else {
        console.error(
          `[WebRTC] Cannot send file-rejected for ${transferId}: Data channel not open or connection missing.`,
        )
      }
    } else {
      console.warn(
        `[WebRTC] rejectTransfer called for ${transferId}, but no pending incoming transfer found or status is not pending.`,
      )
    }
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
      chunks: {
        ...transfer.chunks,

        data: transfer.direction === "incoming" ? new Array(transfer.chunks.total).fill(null) : undefined,
        receivedIndices: transfer.direction === "incoming" ? new Set<number>() : undefined,
      },
    }

    if (transfer.direction === "incoming") {
      newTransfer.startTime = Date.now()
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

  clearAllTransfers: () => {
    set({ transfers: [] })

    try {
      localStorage.setItem("transfersCleared", "true")
    } catch (e) {
      console.error("Failed to save transfers cleared state to localStorage", e)
    }
  },

  downloadFile: (transferId: string) => {
    const { transfers } = get()
    const transfer = transfers.find((t) => t.fileId === transferId)

    if (!transfer) {
      console.error(`[WebRTC] Cannot download file: Transfer ${transferId} not found`)
      return
    }

    if (transfer.status !== "completed") {
      console.warn(`[WebRTC] Cannot download file: Transfer ${transferId} is not completed`)
      return
    }

    if (transfer.direction !== "incoming") {
      console.warn(`[WebRTC] Cannot download file: Transfer ${transferId} is not an incoming transfer`)
      return
    }

    try {
      if (transfer.usesFileSystemAccessAPI && transfer.fileHandle) {
        console.log(`[WebRTC] File ${transfer.fileName} already saved via File System Access API`)

        if ("showInFolder" in window && typeof window.showInFolder === "function") {
          window.showInFolder(transfer.fileHandle)
        } else {
          console.log(`[WebRTC] Cannot show file in folder: API not available`)
        }
        return
      }

      if (transfer.fileBlob) {
        const url = URL.createObjectURL(transfer.fileBlob)
        const a = document.createElement("a")
        a.href = url
        a.download = transfer.fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        console.log(`[WebRTC] File ${transfer.fileName} downloaded via Blob`)
      } else {
        console.error(`[WebRTC] Cannot download file: No Blob available for ${transferId}`)
      }
    } catch (error) {
      console.error(`[WebRTC] Error downloading file ${transfer.fileName}:`, error)
    }
  },

  retryConnectionWithRelay: async (peerId: string) => {
    console.log(`[WebRTC] Retrying connection with ${peerId} in relay-only mode`)

    get().closePeerConnection(peerId)

    const relayConfig: RTCConfiguration = {
      iceServers: [
        {
          // For relay-only mode, we use just one TURN server with both UDP and TCP options
          urls: [
            import.meta.env.VITE_TURN_URL_1 || "turn:standard.relay.metered.ca:80", // UDP
            import.meta.env.VITE_TURN_URL_2 || "turn:standard.relay.metered.ca:80?transport=tcp", // TCP fallback
          ],
          username: import.meta.env.VITE_TURN_USERNAME || "openrelayproject",
          credential: import.meta.env.VITE_TURN_CREDENTIAL || "openrelayproject",
        },
      ],
      iceTransportPolicy: "relay" as RTCIceTransportPolicy,
      iceCandidatePoolSize: 3, // Even smaller pool for relay-only mode
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for peer ${peerId} with relay-only config`)
    const peerConnection = new RTCPeerConnection(relayConfig)

    const dataChannel = peerConnection.createDataChannel("fileTransfer", {
      ordered: true,
      maxRetransmits: 30,
    })

    dataChannel.bufferedAmountLowThreshold = 65536 * 8
    dataChannel.binaryType = "arraybuffer"

    const newPeerEntry: PeerConnection = {
      connection: peerConnection,
      dataChannel,
      sessionId: peerId,
    }

    get().peerConnections.set(peerId, newPeerEntry)
    set({ peerConnections: new Map(get().peerConnections) })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    const socket = useSocketStore.getState().socket
    if (socket) {
      socket.emit("relay-offer", { offer, peerId })
      console.log(`[WebRTC] Relay-only offer sent to ${peerId}`)
    }
  },
}))
