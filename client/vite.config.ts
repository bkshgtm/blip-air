import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true, // This allows the server to be accessible from other devices on the network
    https: {
      key: path.resolve(__dirname, 'key.pem'), // Adjust path/filename if needed
      cert: path.resolve(__dirname, 'cert.pem'), // Adjust path/filename if needed
    },
  },
})
