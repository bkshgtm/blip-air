"use client"

import { useEffect } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { ChakraProvider, extendTheme } from "@chakra-ui/react"
import { useSocketStore } from "./store/socketStore"
import { useWebRTCStore } from "./store/webrtcStore"
import HomePage from "./pages/HomePage"
import TransferPage from "./pages/TransferPage"
import SettingsPage from "./pages/SettingsPage"
import Layout from "./components/Layout"
import theme from "./theme"

const extendedTheme = extendTheme({
  ...theme,
  components: {
    ...theme.components,
    Toast: {
      baseStyle: {
        container: {
          bg: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(10px)",
          borderRadius: "full",

          p: 5,
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
    },
  },
})

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { initSocket } = useSocketStore()
  const { setNavigate } = useWebRTCStore.getState()

  useEffect(() => {
    initSocket()
  }, [initSocket])

  useEffect(() => {
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
