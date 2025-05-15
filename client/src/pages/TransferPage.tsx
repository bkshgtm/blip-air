"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import FileDropZone from "../components/FileDropZone"
import PeerList from "../components/PeerList"
import TransferList from "../components/TransferList"
import TransferStats from "../components/TransferStats"
import { useSocketStore } from "../store/socketStore"
import { useWebRTCStore } from "../store/webrtcStore"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { useTheme } from "../components/theme-provider"
import { useSettingsStore } from "../store/settingsStore"

const TransferPage = () => {
  const { toast } = useToast()
  const { isConnected, sessionId } = useSocketStore()
  const { transfers } = useWebRTCStore()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    const completedTransfers = transfers.filter((t) => t.status === "completed" && !t._notified)
    const errorTransfers = transfers.filter((t) => t.status === "error" && !t._notified)

    completedTransfers.forEach((transfer) => {
      toast({
        title: "Transfer Complete",
        description: `${transfer.fileName} has been ${
          transfer.direction === "incoming" ? "received" : "sent"
        } successfully.`,
        variant: "glass",
      })

      transfer._notified = true
    })

    errorTransfers.forEach((transfer) => {
      toast({
        title: "Transfer Failed",
        description: transfer.error || "An unknown error occurred",
        variant: "destructive",
      })

      transfer._notified = true
    })
  }, [transfers, toast])

  return (
    <div className="container mx-auto py-4 space-y-6">
      {/* Header and Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center mb-4">
          <h1
            className={`text-2xl font-display font-medium tracking-tight ${
              isDark ? "text-white/90" : "text-black/90"
            } mb-2`}
          >
            Transfer Files
          </h1>
          <span className="px-5 py-2 text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.3)]">
            Your Name: <span className="font-bold text-green-300">{useSettingsStore().sessionName}</span>
          </span>
        </div>

        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Alert
              variant="destructive"
              className={`mb-4 ${
                isDark ? "glass bg-white/5 border-white/10" : "glass-light bg-black/5 border-black/10"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 ${isDark ? "text-white/80" : "text-black/80"}`} />
              <AlertTitle className={isDark ? "text-white/90" : "text-black/90"}>Not Connected</AlertTitle>
              <AlertDescription className={isDark ? "text-white/70" : "text-black/70"}>
                Not connected to signaling server. Please check your connection.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {isConnected && !sessionId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Alert
              className={`mb-4 ${
                isDark ? "glass bg-white/5 border-white/10" : "glass-light bg-black/5 border-black/10"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 ${isDark ? "text-white/80" : "text-black/80"}`} />
              <AlertTitle className={isDark ? "text-white/90" : "text-black/90"}>Connecting</AlertTitle>
              <AlertDescription className={isDark ? "text-white/70" : "text-black/70"}>
                Connecting to signaling server...
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full h-full"
        >
          <FileDropZone />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full h-full"
        >
          <PeerList />
        </motion.div>
      </div>

      {transfers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full"
        >
          <TransferStats />
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="w-full"
      >
        <TransferList />
      </motion.div>
    </div>
  )
}

export default TransferPage
