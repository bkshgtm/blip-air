import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    https: {
      key: path.resolve(__dirname, "key.pem"),
      cert: path.resolve(__dirname, "cert.pem"),
    },
  },
})
