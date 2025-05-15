"use client"

import { motion } from "framer-motion"
import { Button } from "../components/ui/button"
import { useNavigate } from "react-router-dom"
import { useUiStore } from "../store/uiStore"
import { useTheme } from "../components/theme-provider"
import { Shield, Zap, Lock } from "lucide-react"

const HomePage = () => {
  const navigate = useNavigate()
  const { openQrCodeModal } = useUiStore()
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const features = [
    {
      title: "LAN Only",
      description: "Works only on your local network for maximum privacy and speed",
      icon: <Lock className="w-7 h-7" />,
    },
    {
      title: "End-to-End Encryption",
      description: "WebRTC encryption keeps your files secure during transfer",
      icon: <Shield className="w-7 h-7" />,
    },
    {
      title: "Fast Transfers",
      description: "Direct peer-to-peer connection for lightning-fast file sharing",
      icon: <Zap className="w-7 h-7" />,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <motion.h1
            className={`text-4xl md:text-6xl font-display font-medium tracking-tight mb-6 ${
              isDark ? "text-white/90" : "text-black/90"
            }`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            BlipAir:{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Just You and Your Files.
            </span>
          </motion.h1>

          <motion.p
            className={`text-xl mb-8 ${isDark ? "text-white/60" : "text-black/60"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Send files between devices on the same Wi-Fi—secure, fast, and cloud-free.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button onClick={() => navigate("/transfer")} size="lg" className="rounded-full px-8">
              Start Sharing
            </Button>

            <Button onClick={openQrCodeModal} variant="outline" size="lg" className="rounded-full px-8">
              Share QR Code
            </Button>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              <div className={`mb-4 ${isDark ? "text-white/80" : "text-black/90"}`}>{feature.icon}</div>
              <h3 className={`text-xl font-medium mb-2 ${isDark ? "text-white/90" : "text-black/90"}`}>
                {feature.title}
              </h3>
              <p className={isDark ? "text-white/50" : "text-black/50"}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HomePage
