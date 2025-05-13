import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],
          "babel-plugin-transform-remove-console",
        ],
      },
    }),
  ],
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
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          chakra: ["@chakra-ui/react", "@emotion/react", "@emotion/styled"],
          animation: ["framer-motion"],
          webrtc: ["socket.io-client"],
        },
      },
    },
  },
})
