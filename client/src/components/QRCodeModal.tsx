"use client"

import { motion, AnimatePresence } from "framer-motion"
import QRCode from "qrcode.react"
import { useSettingsStore } from "../store/settingsStore"
import { useSocketStore } from "../store/socketStore"
import { X } from "lucide-react"

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
}

const QRCodeModal = ({ isOpen, onClose }: QRCodeModalProps) => {
  const { sessionName, pin } = useSettingsStore()
  const { sessionId } = useSocketStore()

  const appUrl = window.location.origin

  const qrValue = JSON.stringify({
    url: `${appUrl}/transfer`,
    sessionId,
    sessionName,
    pin,
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[rgba(18,19,24,0.8)] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
                <h2 className="text-lg font-medium text-white/90">Connect with QR Code</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full text-white/40 hover:text-white/90 hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="p-4 bg-white rounded-xl shadow-lg"
                >
                  <QRCode value={qrValue} size={200} level="H" includeMargin renderAs="svg" />
                </motion.div>

                <div className="mt-6 text-center space-y-1.5">
                  <p className="text-white/80 font-medium">Session: {sessionName}</p>
                  <p className="text-white/60 text-sm">PIN: {pin}</p>
                  {sessionId && <p className="text-white/40 text-xs mt-2">ID: {sessionId.substring(0, 8)}...</p>}
                  <p className="text-white/60 text-xs mt-2">Scan to join this session on the transfer page</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default QRCodeModal
