"use client"

import { useEffect } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom" // Import useNavigate
import { AnimatePresence } from "framer-motion"
import { ChakraProvider, extendTheme } from "@chakra-ui/react"
import { useSocketStore } from "./store/socketStore"
import { useWebRTCStore } from "./store/webrtcStore" // Import useWebRTCStore
import HomePage from "./pages/HomePage"
import TransferPage from "./pages/TransferPage"
import SettingsPage from "./pages/SettingsPage"
import Layout from "./components/Layout"
import theme from "./theme"

// Extend theme with custom toast styles
const extendedTheme = extendTheme({
  ...theme,
  components: {
    ...theme.components,
    Toast: {
      baseStyle: {
        container: {
          bg: "rgba(0, 0, 0, 0.7)", // Slightly more opaque
          backdropFilter: "blur(10px)", // Slightly less blur
          borderRadius: "full", // Kept fully rounded corners
          // Removed border and borderColor
          // Removed boxShadow
          p: 5, // Increased padding slightly
          m: 4,
          maxWidth: "400px",
          ".chakra-toast__title": {
            fontWeight: "bold",
            fontSize: "lg",
          },
          ".chakra-toast__description": {
            opacity: 0.8,
          },
          ".chakra-toast__close-btn": {
            borderRadius: "full",
            _hover: {
              bg: "rgba(255, 255, 255, 0.1)",
            },
          },
        },
      },
      // Removed defaultProps to re-enable animations
    },
  },
})

function App() {
  const location = useLocation()
  const navigate = useNavigate() // Get navigate function
  const { initSocket } = useSocketStore()
  const { setNavigate } = useWebRTCStore.getState() // Get setNavigate from store

  useEffect(() => {
    // Initialize socket connection when app loads
    initSocket()

    // The socket will remain active as long as the app is open.
    // It will disconnect when the browser tab is closed or if disconnectSocket is called explicitly.
  }, [initSocket])

  useEffect(() => {
    // Set the navigate function in the WebRTC store once on mount
    setNavigate(navigate)
  }, [navigate, setNavigate])

  return (
    <ChakraProvider theme={extendedTheme}>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </ChakraProvider>
  )
}

export default App
