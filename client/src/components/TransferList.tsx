"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileIcon, Pause, Play, X, Trash2 } from "lucide-react"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize, formatSpeed, formatTime } from "../lib/chunking"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ScrollArea } from "./ui/scroll-area"
import { Separator } from "./ui/separator"
import { useTheme } from "./theme-provider"

const TransferList = () => {
  const { transfers, pauseTransfer, resumeTransfer, cancelTransfer, acceptTransfer, rejectTransfer } = useWebRTCStore()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const pendingTransferRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const pendingIncomingTransfers = transfers.filter((t) => t.status === "pending" && t.direction === "incoming")

    if (pendingIncomingTransfers.length > 0 && scrollAreaRef.current) {
      const latestTransfer = pendingIncomingTransfers[pendingIncomingTransfers.length - 1]

      const transferElement = pendingTransferRefs.current[latestTransfer.fileId]

      if (transferElement) {
        setTimeout(() => {
          transferElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        }, 300)
      }
    }
  }, [transfers])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "!bg-green-500/20 !text-green-500 !border-green-500/30"
      case "transferring":
        return "!bg-blue-500/20 !text-blue-500 !border-blue-500/30"
      case "paused":
        return "!bg-yellow-500/20 !text-yellow-500 !border-yellow-500/30"
      case "error":
        return "!bg-red-500/20 !text-red-500 !border-red-500/30"
      default:
        return "!bg-blue-500/20 !text-blue-500 !border-blue-500/30"
    }
  }

  const handleClearAllTransfers = () => {
    useWebRTCStore.getState().clearAllTransfers()
  }

  return (
    <Card className={isDark ? "glass-card" : "glass-card-light"}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className={`text-base sm:text-lg ${isDark ? "text-white/90" : "text-black/90"} font-medium`}>
            Transfers
          </CardTitle>
          {transfers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllTransfers}
              className={`h-8 gap-1 ${
                isDark
                  ? "text-white/60 hover:text-white/90 hover:bg-white/5"
                  : "text-black/60 hover:text-black/90 hover:bg-black/5"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-xs">Clear All</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <Separator className={isDark ? "bg-white/5" : "bg-black/5"} />
      <CardContent className="pt-4">
        {transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center space-y-2">
            <p className={isDark ? "text-white/60" : "text-black/60"}>No active transfers</p>
            <p className={`text-xs sm:text-sm ${isDark ? "text-white/40" : "text-black/40"}`}>
              Select files and a peer to start transferring
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4" ref={scrollAreaRef}>
            <AnimatePresence>
              <div className="space-y-3 sm:space-y-4">
                {transfers.map((transfer) => (
                  <motion.div
                    key={transfer.fileId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    ref={(el) => {
                      if (transfer.status === "pending" && transfer.direction === "incoming") {
                        pendingTransferRefs.current[transfer.fileId] = el
                      }
                    }}
                  >
                    <div className={`p-3 sm:p-4 rounded-lg space-y-2 sm:space-y-3 ${isDark ? "glass" : "glass-light"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`p-1.5 sm:p-2 rounded-md ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                            <FileIcon
                              className={`w-3 h-3 sm:w-4 sm:h-4 ${isDark ? "text-white/80" : "text-black/80"}`}
                            />
                          </div>
                          <div className="overflow-hidden">
                            <p
                              className={`font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px] md:max-w-[250px] ${
                                isDark ? "text-white/90" : "text-black/90"
                              }`}
                            >
                              {transfer.fileName}
                            </p>
                            <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                              {formatFileSize(transfer.fileSize)}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs ${getStatusBadge(transfer.status)}`}
                          style={{
                            backgroundColor:
                              transfer.status === "completed"
                                ? "rgba(34, 197, 94, 0.2)"
                                : transfer.status === "transferring"
                                ? "rgba(59, 130, 246, 0.2)"
                                : transfer.status === "paused"
                                ? "rgba(234, 179, 8, 0.2)"
                                : transfer.status === "error"
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(59, 130, 246, 0.2)",
                            color:
                              transfer.status === "completed"
                                ? "rgb(34, 197, 94)"
                                : transfer.status === "transferring"
                                ? "rgb(59, 130, 246)"
                                : transfer.status === "paused"
                                ? "rgb(234, 179, 8)"
                                : transfer.status === "error"
                                ? "rgb(239, 68, 68)"
                                : "rgb(59, 130, 246)",
                            borderColor:
                              transfer.status === "completed"
                                ? "rgba(34, 197, 94, 0.3)"
                                : transfer.status === "transferring"
                                ? "rgba(59, 130, 246, 0.3)"
                                : transfer.status === "paused"
                                ? "rgba(234, 179, 8, 0.3)"
                                : transfer.status === "error"
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(59, 130, 246, 0.3)",
                          }}
                        >
                          {transfer.status}
                        </Badge>
                      </div>

                      {transfer.status === "pending" && transfer.direction === "incoming" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`gap-1 text-[10px] sm:text-xs ${
                              isDark ? "btn-glass" : "btn-glass-light"
                            } h-7 sm:h-8`}
                            onClick={() => acceptTransfer(transfer.fileId)}
                          >
                            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`text-[10px] sm:text-xs h-7 sm:h-8 ${
                              isDark
                                ? "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white/90"
                                : "bg-black/5 text-black/80 hover:bg-black/10 hover:text-black/90"
                            }`}
                            onClick={() => rejectTransfer(transfer.fileId)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="progress-bar">
                            <motion.div
                              className="progress-bar-fill"
                              initial={{ width: 0 }}
                              animate={{
                                width:
                                  transfer.status === "completed"
                                    ? "100%"
                                    : `${Math.max(0, Math.min(100, transfer.progress * 100))}%`,
                              }}
                              transition={{
                                duration: transfer.status === "completed" ? 0.5 : 0.3,
                                ease: transfer.status === "completed" ? "easeOut" : "linear",
                              }}
                              style={{
                                backgroundColor:
                                  transfer.status === "completed"
                                    ? "rgba(34, 197, 94, 0.8)"
                                    : transfer.status === "paused"
                                    ? "rgba(234, 179, 8, 0.8)"
                                    : transfer.status === "error"
                                    ? "rgba(239, 68, 68, 0.8)"
                                    : undefined,
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                              {transfer.status === "transferring" && (
                                <>
                                  {formatSpeed(transfer.speed)} • {formatTime(transfer.eta)} remaining
                                </>
                              )}
                              {transfer.status === "completed" && "Transfer complete"}
                              {transfer.status === "paused" && "Transfer paused"}
                              {transfer.status === "error" && transfer.error}
                            </p>

                            <div className="flex items-center gap-1">
                              {transfer.status !== "completed" && transfer.status !== "error" && (
                                <>
                                  {transfer.status === "transferring" ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-6 w-6 sm:h-7 sm:w-7 ${
                                        isDark
                                          ? "text-white/60 hover:text-white/90 hover:bg-white/5"
                                          : "text-black/60 hover:text-black/90 hover:bg-black/5"
                                      }`}
                                      onClick={() => pauseTransfer(transfer.fileId)}
                                    >
                                      <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-6 w-6 sm:h-7 sm:w-7 ${
                                        isDark
                                          ? "text-white/60 hover:text-white/90 hover:bg-white/5"
                                          : "text-black/60 hover:text-black/90 hover:bg-black/5"
                                      }`}
                                      onClick={() => resumeTransfer(transfer.fileId)}
                                    >
                                      <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    </Button>
                                  )}
                                </>
                              )}

                              {transfer.status === "completed" && transfer.direction === "incoming" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`gap-1 text-[10px] sm:text-xs ${
                                    isDark
                                      ? "bg-green-600/80 hover:bg-green-500 text-white border-green-500/30"
                                      : "bg-green-500/90 hover:bg-green-400 text-white border-green-400/30"
                                  } h-7 sm:h-8 px-2 sm:px-3`}
                                  onClick={() => useWebRTCStore.getState().downloadFile(transfer.fileId)}
                                >
                                  <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  Download
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 sm:h-7 sm:w-7 ${
                                  isDark
                                    ? "text-white/60 hover:text-white/90 hover:bg-white/5"
                                    : "text-black/60 hover:text-black/90 hover:bg-black/5"
                                }`}
                                onClick={() => cancelTransfer(transfer.fileId)}
                              >
                                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                      {transfer.status === "error" && transfer.error?.includes("Connection") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => useWebRTCStore.getState().retryConnectionWithRelay(transfer.peerId)}
                          className="ml-2"
                        >
                          Retry with Relay
                        </Button>
                      )}
                      {transfer.status === "paused" && transfer.error?.includes("Connection") && (
                        <div className="flex items-center mt-2">
                          <Badge variant="outline" className={`status-warning`}>
                            Connection Issue
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => useWebRTCStore.getState().retryConnectionWithRelay(transfer.peerId)}
                            className="ml-2"
                          >
                            Retry with Relay
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

export default TransferList
