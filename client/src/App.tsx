"use client"

import { useEffect } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/toaster"

import { useSocketStore } from "./store/socketStore"
import { useWebRTCStore } from "./store/webrtcStore"

import HomePage from "./pages/HomePage"
import TransferPage from "./pages/TransferPage"
import SettingsPage from "./pages/SettingsPage"
import Layout from "./components/Layout"

function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const { initSocket, disconnectSocket } = useSocketStore()
  const setNavigate = useWebRTCStore((state) => state.setNavigate)

  useEffect(() => {
    setNavigate(navigate)
    return () => {
      setNavigate(() => {})
    }
  }, [navigate, setNavigate])

  useEffect(() => {
    // Initialize socket connection when app loads
    initSocket()

    // Cleanup socket connection when app unmounts
    return () => {
      disconnectSocket()
    }
  }, [initSocket, disconnectSocket])

  return (
    <ThemeProvider defaultTheme="dark">
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AnimatePresence>
      </Layout>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
