"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { Github } from "lucide-react"
import Navbar from "./Navbar"
import QRCodeModal from "./QRCodeModal"
import { useUiStore } from "../store/uiStore"

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const { isQrCodeModalOpen, closeQrCodeModal } = useUiStore()

  return (
    <div className="min-h-screen bg-[#0e1016] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e1016] to-[#0a0b10] z-0" />

        <div className="absolute inset-0 opacity-[0.07] z-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent animate-gradient-x" />
        </div>

        <div className="absolute inset-0 noise-overlay opacity-[0.015] z-0" />

        <div
          className="absolute inset-0 z-0 opacity-[0.10]"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px), 
                              linear-gradient(90deg, rgba(255, 255, 255, 0.2) 1px, transparent 1px)`,
            backgroundSize: "25px 25px",
          }}
        />
      </div>

      <Navbar />

      <motion.main
        className="flex-1 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {/* Footer with creator info - reduced height */}
      <footer className="relative z-10 py-2 mt-3 border-t border-white/10 bg-white/[0.03] backdrop-blur-sm">
        <div className="container mx-auto px-4 flex items-center justify-center gap-3">
          <span className="text-white/80 text-xs font-medium">Created by Bikash Gautam</span>
          <div className="h-2.5 w-px bg-white/20"></div>
          <a
            href="https://github.com/bkshgtm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white/60 hover:text-white/90 transition-colors text-xs"
          >
            <Github size={14} />
            <span>GitHub</span>
          </a>
        </div>
      </footer>

      <QRCodeModal isOpen={isQrCodeModalOpen} onClose={closeQrCodeModal} />
    </div>
  )
}

export default Layout
