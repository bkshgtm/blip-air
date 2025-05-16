"use client"

import { motion } from "framer-motion"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize, formatSpeed } from "../lib/chunking"
import { Card, CardContent } from "./ui/card"
import { useTheme } from "./theme-provider"

const TransferStats = () => {
  const { transfers } = useWebRTCStore()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  const activeTransfers = transfers.filter((t) => t.status === "transferring" || t.status === "paused")
  const completedTransfers = transfers.filter((t) => t.status === "completed")
  const totalSize = transfers.filter((t) => t.status !== "error").reduce((acc, t) => acc + t.fileSize, 0)
  const totalTransferred = transfers.reduce((acc, t) => {
    if (t.status === "completed") {
      return acc + t.fileSize
    } else if (t.status === "error") {
      return acc
    } else {
      return acc + t.fileSize * t.progress
    }
  }, 0)

  const transferringFiles = transfers.filter((t) => t.status === "transferring")
  const averageSpeed =
    transferringFiles.length > 0 ? transferringFiles.reduce((acc, t) => acc + t.speed, 0) / transferringFiles.length : 0

  const overallProgress = totalSize > 0 ? totalTransferred / totalSize : 0

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className={isDark ? "glass-card" : "glass-card-light"}>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                <svg className="h-12 w-12 sm:h-16 sm:w-16 transform -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="21"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="5"
                    fill="none"
                    className={isDark ? "text-white" : "text-black"}
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="21"
                    stroke="currentColor"
                    strokeOpacity="0.6"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={21 * 2 * Math.PI}
                    strokeDashoffset={21 * 2 * Math.PI * (1 - overallProgress)}
                    className={`transition-all duration-300 ${isDark ? "text-white" : "text-black"}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs sm:text-sm font-medium ${isDark ? "text-white/90" : "text-black/90"}`}>
                    {Math.round(overallProgress * 100)}%
                  </span>
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className={`text-xs sm:text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Overall Progress</p>
                <p className={`text-xs sm:text-sm ${isDark ? "text-white/80" : "text-black/80"}`}>
                  {formatFileSize(totalTransferred)} / {formatFileSize(totalSize)}
                </p>
              </div>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className={`text-xs sm:text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Active Transfers</p>
              <motion.p
                key={`active-${activeTransfers.length}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-base sm:text-xl font-semibold ${isDark ? "text-white/90" : "text-black/90"}`}
              >
                {activeTransfers.length}
              </motion.p>
              <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                {activeTransfers.length > 0 ? `${activeTransfers.length} in progress` : "No active transfers"}
              </p>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className={`text-xs sm:text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Completed</p>
              <motion.p
                key={`completed-${completedTransfers.length}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-base sm:text-xl font-semibold ${isDark ? "text-white/90" : "text-black/90"}`}
              >
                {completedTransfers.length}
              </motion.p>
              <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                {completedTransfers.length > 0
                  ? `${formatFileSize(completedTransfers.reduce((acc, t) => acc + t.fileSize, 0))} transferred`
                  : "No completed transfers"}
              </p>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className={`text-xs sm:text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Current Speed</p>
              <motion.p
                key={`speed-${Math.floor(averageSpeed / 1024)}`}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                className={`text-base sm:text-xl font-semibold ${isDark ? "text-white/90" : "text-black/90"}`}
              >
                {formatSpeed(averageSpeed)}
              </motion.p>
              <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                {activeTransfers.length > 0 ? `Across ${activeTransfers.length} transfers` : "No active transfers"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default TransferStats
