"use client"

import { useEffect } from "react"
import { Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { useSocketStore } from "./store/socketStore"
import HomePage from "./pages/HomePage"
import TransferPage from "./pages/TransferPage"
import SettingsPage from "./pages/SettingsPage"
import Layout from "./components/Layout"


function App() {
  const location = useLocation()
  const { initSocket, disconnectSocket } = useSocketStore()

  useEffect(() => {
    // Initialize socket connection when app loads
    initSocket()

    // The socket will remain active as long as the app is open.
    // It will disconnect when the browser tab is closed or if disconnectSocket is called explicitly.
  }, [initSocket])

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
