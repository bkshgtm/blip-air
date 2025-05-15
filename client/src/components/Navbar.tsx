"use client"

import { useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { Settings, Home, FileUp, QrCode, Menu } from "lucide-react"
import { useSettingsStore } from "../store/settingsStore"
import { useUiStore } from "../store/uiStore"
import { useIsMobile } from "../hooks/use-mobile"
import { useState } from "react"

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionName } = useSettingsStore()
  const { openQrCodeModal } = useUiStore()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { name: "Home", path: "/", icon: <Home className="w-[24px] h-[24px]" /> },
    { name: "Transfer", path: "/transfer", icon: <FileUp className="w-[24px] h-[24px]" /> },
    { name: "Settings", path: "/settings", icon: <Settings className="w-[24px] h-[24px]" /> },
  ]

  return (
    <nav className="relative z-20 py-4 sm:py-8 px-4 sm:px-10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
          <motion.div
            className="flex items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <img src="favicon/logo.png" alt="BlipAir Logo" className="h-8 w-8 sm:h-10 sm:w-10 mr-2 sm:mr-3" />
              <span className="text-2xl sm:text-3xl font-bold tracking-tighter text-white/90 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                BlipAir
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-1 sm:mt-0"
          >
            <span
              className="px-3 py-1 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full cursor-pointer hover:bg-green-500/30 transition-colors duration-200"
              onClick={() => navigate("/transfer")}
            >
              {sessionName}
            </span>
          </motion.div>
        </div>

        {isMobile ? (
          <div className="flex items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-3 rounded-full text-white/70 hover:text-white/90 hover:bg-white/[0.05] transition-all duration-200"
              aria-label="Menu"
            >
              <Menu className="w-[24px] h-[24px]" />
            </motion.button>

            {menuOpen && (
              <motion.div
                className="absolute top-16 right-4 bg-black/80 backdrop-blur-lg rounded-lg p-2 border border-white/10"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex flex-col gap-1">
                  {navItems.map((item) => (
                    <motion.button
                      key={item.path}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        navigate(item.path)
                        setMenuOpen(false)
                      }}
                      className={`p-3 rounded-lg flex items-center gap-3 transition-all duration-200 ${
                        isActive(item.path)
                          ? "text-white/90 bg-white/[0.1]"
                          : "text-white/60 hover:text-white/80 hover:bg-white/[0.05]"
                      }`}
                      aria-label={item.name}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </motion.button>
                  ))}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      openQrCodeModal()
                      setMenuOpen(false)
                    }}
                    className="p-3 rounded-lg flex items-center gap-3 text-white/60 hover:text-white/80 hover:bg-white/[0.05] transition-all duration-200"
                    aria-label="QR Code"
                  >
                    <QrCode className="w-[24px] h-[24px]" />
                    <span>QR Code</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {navItems.map((item) => (
              <motion.button
                key={item.path}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(item.path)}
                className={`p-4 rounded-full transition-all duration-200 ${
                  isActive(item.path)
                    ? "text-white/90 bg-white/[0.07]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
                aria-label={item.name}
              >
                {item.icon}
              </motion.button>
            ))}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openQrCodeModal}
              className="p-4 rounded-full text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-all duration-200"
              aria-label="QR Code"
            >
              <QrCode className="w-[24px] h-[24px]" />
            </motion.button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
