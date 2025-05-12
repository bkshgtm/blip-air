"use client"

import { type ReactNode, useEffect } from "react"
import { Box, Flex, useColorMode, useDisclosure } from "@chakra-ui/react" // useDisclosure might not be needed here anymore
import { useSettingsStore } from "../store/settingsStore"
import { useUiStore } from "../store/uiStore" // Import the new UI store
import Navbar from "./Navbar"
import QRCodeModal from "./QRCodeModal" // Import the modal
import { AnimatePresence, motion } from "framer-motion"

interface LayoutProps {
  children: ReactNode
}

const MotionBox = motion(Box)

const Layout = ({ children }: LayoutProps) => {
  const { darkMode } = useSettingsStore()
  const { colorMode, setColorMode } = useColorMode()
  const { isQrCodeModalOpen, closeQrCodeModal } = useUiStore()

  // Sync color mode with settings
  useEffect(() => {
    setColorMode(darkMode ? "dark" : "light")
  }, [darkMode, setColorMode])

  return (
    <Flex direction="column" minH="100vh">
      <Navbar /> {/* Navbar will be modified later to use uiStore.openQrCodeModal */}
      <AnimatePresence mode="wait">
        <MotionBox
          flex="1"
          p={4}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }} // Faster: 0.3 -> 0.2
        >
          {children}
        </MotionBox>
      </AnimatePresence>
      <QRCodeModal isOpen={isQrCodeModalOpen} onClose={closeQrCodeModal} />
    </Flex>
  )
}

export default Layout
