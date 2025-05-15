"use client"

import { motion } from "framer-motion"
import { useSettingsStore } from "../store/settingsStore"
import { formatFileSize } from "../lib/chunking"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "../components/theme-provider"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const SettingsPage = () => {
  const { sessionName, pin, chunkSize, useCompression, setSessionName, setPin, setChunkSize, toggleCompression } =
    useSettingsStore()

  const [localSessionName, setLocalSessionName] = useState(sessionName)
  const [localPin, setLocalPin] = useState(pin)
  const [localChunkSize, setLocalChunkSize] = useState(chunkSize)
  const [localUseCompression, setLocalUseCompression] = useState(useCompression)

  const { theme } = useTheme()
  const { toast } = useToast()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const handleSaveSettings = () => {
    setSessionName(localSessionName)
    setPin(localPin)
    setChunkSize(localChunkSize)
    if (localUseCompression !== useCompression) {
      toggleCompression()
    }

    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully",
      variant: isDark ? "glass" : "default",
    })
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className={`text-2xl font-display font-medium tracking-tight mb-6 ${
            isDark ? "text-white/90" : "text-black/90"
          }`}
        >
          Settings
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className={isDark ? "glass-card" : "glass-card-light"}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg ${isDark ? "text-white/90" : "text-black/90"} font-medium`}>
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <Separator className={isDark ? "bg-white/5" : "bg-black/5"} />
              <CardContent className="pt-4 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="session-name" className={isDark ? "text-white/70" : "text-black/70"}>
                    Session Name
                  </Label>
                  <Input
                    id="session-name"
                    value={localSessionName}
                    onChange={(e) => setLocalSessionName(e.target.value)}
                    placeholder="Enter a name for your session"
                    className={
                      isDark
                        ? "glass bg-white/5 border-white/10 text-white/80 focus:border-white/20 focus:ring-white/10"
                        : "glass-light bg-black/5 border-black/10 text-black/80 focus:border-black/20 focus:ring-black/10"
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pin" className={isDark ? "text-white/70" : "text-black/70"}>
                    PIN Code
                  </Label>
                  <Input
                    id="pin"
                    value={localPin}
                    onChange={(e) => setLocalPin(e.target.value)}
                    placeholder="Enter a PIN for secure connections"
                    maxLength={4}
                    className={
                      isDark
                        ? "glass bg-white/5 border-white/10 text-white/80 focus:border-white/20 focus:ring-white/10"
                        : "glass-light bg-black/5 border-black/10 text-black/80 focus:border-black/20 focus:ring-black/10"
                    }
                  />
                  <p className={`text-xs ${isDark ? "text-white/40" : "text-black/40"} mt-1`}>
                    This PIN will be required for other devices to connect
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className={isDark ? "glass-card" : "glass-card-light"}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg ${isDark ? "text-white/90" : "text-black/90"} font-medium`}>
                  Appearance & Performance
                </CardTitle>
              </CardHeader>
              <Separator className={isDark ? "bg-white/5" : "bg-black/5"} />
              <CardContent className="pt-4 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="chunk-size" className={isDark ? "text-white/70" : "text-black/70"}>
                      Chunk Size
                    </Label>
                    <span className={`text-sm ${isDark ? "text-white/60" : "text-black/60"}`}>
                      {formatFileSize(localChunkSize)}
                    </span>
                  </div>
                  <Slider
                    id="chunk-size"
                    min={16 * 1024}
                    max={256 * 1024}
                    step={16 * 1024}
                    value={[localChunkSize]}
                    onValueChange={(value) => setLocalChunkSize(value[0])}
                    className={
                      isDark
                        ? "[&>span]:bg-white/20 [&>span]:hover:bg-white/30"
                        : "[&>span]:bg-black/20 [&>span]:hover:bg-black/30"
                    }
                  />
                  <p className={`text-xs ${isDark ? "text-white/40" : "text-black/40"} mt-1`}>
                    Smaller chunks are better for unstable connections
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="compression" className={isDark ? "text-white/70" : "text-black/70"}>
                    Use Compression
                  </Label>
                  <Switch
                    id="compression"
                    checked={localUseCompression}
                    onCheckedChange={setLocalUseCompression}
                    className={
                      isDark
                        ? "bg-white/10 data-[state=checked]:bg-white/30"
                        : "bg-black/10 data-[state=checked]:bg-black/30"
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button
            size="lg"
            className={`rounded-full px-8 ${
              isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-black"
            }`}
            onClick={handleSaveSettings}
          >
            Save Settings
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default SettingsPage
