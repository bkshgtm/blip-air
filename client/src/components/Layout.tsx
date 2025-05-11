"use client"

import { type ReactNode, useEffect } from "react"
import { Box, Flex, useColorMode } from "@chakra-ui/react"
import { useSettingsStore } from "../store/settingsStore"
import Navbar from "./Navbar"
import { AnimatePresence, motion } from "framer-motion"

interface LayoutProps {
  children: ReactNode
}

const MotionBox = motion(Box)

const Layout = ({ children }: LayoutProps) => {
  const { darkMode } = useSettingsStore()
  const { colorMode, setColorMode } = useColorMode()

  // Sync color mode with settings
  useEffect(() => {
    setColorMode(darkMode ? "dark" : "light")
  }, [darkMode, setColorMode])

  return (
    <Flex direction="column" minH="100vh">
      <Navbar />
      <AnimatePresence mode="wait">
        <MotionBox
          flex="1"
          p={4}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </MotionBox>
      </AnimatePresence>
    </Flex>
  )
}

export default Layout
