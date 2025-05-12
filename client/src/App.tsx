"use client"

import { useEffect } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom" // Import useNavigate
import { AnimatePresence } from "framer-motion"
import { useSocketStore } from "./store/socketStore"
import { useWebRTCStore } from "./store/webrtcStore" // Import useWebRTCStore
import HomePage from "./pages/HomePage"
import TransferPage from "./pages/TransferPage"
import SettingsPage from "./pages/SettingsPage"
import Layout from "./components/Layout"


function App() {
  const location = useLocation()
  const navigate = useNavigate(); // Get navigate function
  const { initSocket } = useSocketStore()
  const { setNavigate } = useWebRTCStore.getState(); // Get setNavigate from store

  useEffect(() => {
    // Initialize socket connection when app loads
    initSocket()

    // The socket will remain active as long as the app is open.
    // It will disconnect when the browser tab is closed or if disconnectSocket is called explicitly.
  }, [initSocket])

  useEffect(() => {
    // Set the navigate function in the WebRTC store once on mount
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}

export default App
