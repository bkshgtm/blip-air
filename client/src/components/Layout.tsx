"use client"

import { type ReactNode, useEffect } from "react"
import { Box, Flex, useColorMode } from "@chakra-ui/react"
import { useSettingsStore } from "../store/settingsStore"
import { useUiStore } from "../store/uiStore"
import Navbar from "./Navbar"
import QRCodeModal from "./QRCodeModal"
import { AnimatePresence, motion } from "framer-motion"

interface LayoutProps {
  children: ReactNode
}

const MotionBox = motion(Box)

const Layout = ({ children }: LayoutProps) => {
  const { darkMode } = useSettingsStore()
  const { setColorMode } = useColorMode()
  const { isQrCodeModalOpen, closeQrCodeModal } = useUiStore()

  useEffect(() => {
    setColorMode(darkMode ? "dark" : "light")
  }, [darkMode, setColorMode])

  return (
    <Flex direction="column" minH="100vh" position="relative">
      <Navbar />
      <AnimatePresence mode="wait">
        <MotionBox
          flex="1"
          p={4}
          position="relative"
          zIndex="1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </MotionBox>
      </AnimatePresence>
      <QRCodeModal isOpen={isQrCodeModalOpen} onClose={closeQrCodeModal} />
    </Flex>
  )
}

export default Layout
