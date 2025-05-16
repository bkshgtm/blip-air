"use client"

import { motion } from "framer-motion"
import { Send, User, Wifi, WifiOff, AlertTriangle, Info } from "lucide-react"
import { useSocketStore } from "../store/socketStore"
import { useWebRTCStore } from "../store/webrtcStore"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { ScrollArea } from "./ui/scroll-area"
import { Separator } from "./ui/separator"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { useState, useEffect } from "react"
import { useTheme } from "./theme-provider"

const PeerList = () => {
  const { toast } = useToast()
  const { peers, networkInfo } = useSocketStore()
  const { selectedFiles, createPeerConnection, sendFiles } = useWebRTCStore()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [hasFiles, setHasFiles] = useState<boolean>(false)
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    setHasFiles(selectedFiles.length > 0)
    console.log("Selected files updated:", selectedFiles.length)
  }, [selectedFiles])

  const handleSendFiles = async (peerId: string) => {
    try {
      if (selectedFiles.length === 0) {
        toast({
          title: "No files selected",
          description: "Please select files to send first",
          variant: "destructive",
        })
        return
      }

      setConnecting(peerId)

      await createPeerConnection(peerId)
      await sendFiles(peerId)

      setConnecting(null)
    } catch (error: any) {
      setConnecting(null)
      console.error("Failed to send files:", error)
      toast({
        title: "Transfer failed",
        description: error.message || "Failed to start file transfer",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className={`${isDark ? "glass-card" : "glass-card-light"} h-full`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className={`text-base sm:text-lg ${isDark ? "text-white/90" : "text-black/90"} font-medium`}>
            Available Peers
            {hasFiles && <span className="ml-2 text-xs text-green-500">({selectedFiles.length} files ready)</span>}
          </CardTitle>

          {networkInfo && (
            <div className="flex items-center">
              {networkInfo.isPrivateNetwork ? (
                <Wifi className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <WifiOff className="h-4 w-4 text-yellow-500 mr-1" />
              )}
              <span className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}>
                {networkInfo.peerCount} peers
              </span>
            </div>
          )}
        </div>

        {networkInfo && !networkInfo.isPrivateNetwork && (
          <Alert className="mt-2 py-2 border-yellow-500/50 bg-yellow-500/10" variant="default">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-xs font-medium text-yellow-500">Not on a private network</AlertTitle>
            <AlertDescription className="text-xs text-yellow-500/90">
              You appear to be on a public network. Peer discovery works best on private WiFi networks.
            </AlertDescription>
          </Alert>
        )}

        {networkInfo && networkInfo.isPrivateNetwork && peers.length === 0 && (
          <Alert className="mt-2 py-2 border-blue-500/50 bg-blue-500/10" variant="default">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-xs font-medium text-blue-500">No peers found</AlertTitle>
            <AlertDescription className="text-xs text-blue-500/90">
              You're on a private network ({networkInfo.subnet}), but no peers were found. Make sure other devices are
              on the same WiFi.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <Separator className={isDark ? "bg-white/5" : "bg-black/5"} />
      <CardContent className="pt-4 h-[calc(100%-60px)]">
        {peers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <p className={isDark ? "text-white/60" : "text-black/60"}>No peers found on your network</p>
            <p className={`text-xs sm:text-sm ${isDark ? "text-white/40" : "text-black/40"}`}>
              Make sure other devices are connected to the same WiFi network
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-2 sm:space-y-3">
              {peers.map((peer) => (
                <motion.div
                  key={peer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className={`p-2 sm:p-3 rounded-lg flex items-center justify-between ${
                      isDark ? "glass" : "glass-light"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                      <Avatar
                        className={`h-7 w-7 sm:h-9 sm:w-9 flex items-center justify-center ${
                          isDark ? "bg-red-500/10 border border-red-500/30" : "bg-red-500/5 border border-red-500/20"
                        }`}
                        style={{
                          filter: isDark ? "drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))" : "none",
                        }}
                      >
                        <AvatarFallback
                          className="flex items-center justify-center"
                          style={{
                            color: "#ef4444",
                            textShadow: isDark ? "0 0 8px rgba(255, 251, 0, 0.7)" : "none",
                          }}
                        >
                          <User className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
                        <p
                          className={`font-medium text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[120px] md:max-w-[80px] lg:max-w-[120px] ${
                            isDark ? "text-white/90" : "text-black/90"
                          }`}
                        >
                          {peer.name}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] sm:text-xs status-badge ${
                            isDark ? "border-yellow-500/30" : "border-yellow-500/30"
                          }`}
                          style={{
                            backgroundColor: isDark ? "rgba(234, 179, 8, 0.15)" : "rgba(234, 179, 8, 0.1)",
                            color: "#eab308",
                            textShadow: isDark ? "0 0 8px rgba(234, 179, 8, 0.5)" : "none",
                            boxShadow: isDark ? "0 0 5px rgba(234, 179, 8, 0.2)" : "none",
                          }}
                        >
                          Online
                        </Badge>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedFiles.length === 0 || connecting === peer.id}
                      onClick={() => handleSendFiles(peer.id)}
                      className={`gap-1 text-xs ${
                        selectedFiles.length > 0
                          ? isDark
                            ? "bg-green-600 hover:bg-green-500 text-white border-0"
                            : "bg-green-500 hover:bg-green-400 text-white border-0"
                          : isDark
                          ? "btn-glass"
                          : "btn-glass-light"
                      } px-2 sm:px-3 h-7 sm:h-8`}
                    >
                      {connecting === peer.id ? (
                        <span className="text-[10px] sm:text-xs">Connecting...</span>
                      ) : (
                        <>
                          <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="text-[10px] sm:text-xs">Send</span>
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

export default PeerList
