"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { motion, AnimatePresence } from "framer-motion"
import { FileIcon, Upload, X } from "lucide-react"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize } from "../lib/chunking"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { useTheme } from "./theme-provider"

const FileDropZone = () => {
  const { selectedFiles, setSelectedFiles } = useWebRTCStore()
  const [isDragging, setIsDragging] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setSelectedFiles([...selectedFiles, ...acceptedFiles])
      setIsDragging(false)
    },
    [selectedFiles, setSelectedFiles],
  )

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    noClick: selectedFiles.length > 0,
  })

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles]
    newFiles.splice(index, 1)
    setSelectedFiles(newFiles)
  }

  const clearFiles = () => {
    setSelectedFiles([])
  }

  return (
    <div className="w-full h-full">
      <div {...getRootProps()} className="h-full">
        <motion.div
          className={`w-full h-full relative overflow-hidden rounded-2xl p-4 ${
            isDark ? "glass-card" : "glass-card-light"
          }`}
          initial={{ boxShadow: isDark ? "0 0 0 1px rgba(255, 255, 255, 0.03)" : "0 0 0 1px rgba(0, 0, 0, 0.03)" }}
          animate={{
            boxShadow: isDragging
              ? isDark
                ? "0 0 25px rgba(255, 255, 255, 0.07), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                : "0 0 25px rgba(0, 0, 0, 0.07), 0 0 0 1px rgba(0, 0, 0, 0.1)"
              : isDark
              ? "0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.03)"
              : "0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.03)",
            scale: isDragging ? 1.01 : 1,
          }}
          transition={{ duration: 0.3 }}
          whileHover={selectedFiles.length === 0 ? { scale: 1.005 } : {}}
        >
          {/* Gradient border effect */}
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: isDragging ? 0.1 : 0,
            }}
            style={{
              background: isDark
                ? "linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03), rgba(255,255,255,0.1))"
                : "linear-gradient(45deg, rgba(0,0,0,0.1), rgba(0,0,0,0.03), rgba(0,0,0,0.1))",
              filter: "blur(2px)",
            }}
          />

          {/* Animated gradient background when dragging */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: isDragging ? 0.05 : 0,
            }}
            style={{
              background: isDark
                ? "radial-gradient(circle at center, rgba(255,255,255,0.07) 0%, transparent 70%)"
                : "radial-gradient(circle at center, rgba(0,0,0,0.07) 0%, transparent 70%)",
            }}
          />

          <input {...getInputProps()} />

          {selectedFiles.length === 0 ? (
            <motion.div
              className={`flex flex-col items-center justify-center p-4 sm:p-6 border border-dashed rounded-lg cursor-pointer transition-all w-full h-full relative z-10
                ${
                  isDragActive
                    ? isDark
                      ? "border-white/30 bg-white/5"
                      : "border-black/30 bg-black/5"
                    : isDark
                    ? "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                    : "border-black/10 hover:border-black/20 hover:bg-black/[0.02]"
                }`}
              initial={{ opacity: 0.9 }}
              animate={{
                opacity: isDragging ? 1 : 0.9,
                y: isDragging ? -5 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                initial={{ scale: 1 }}
                animate={{
                  scale: isDragging ? 1.1 : 1,
                  filter: isDragging
                    ? isDark
                      ? "drop-shadow(0 0 8px rgba(255,255,255,0.1))"
                      : "drop-shadow(0 0 8px rgba(0,0,0,0.1))"
                    : "none",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative"
              >
                <Upload
                  className={`w-10 h-10 sm:w-14 sm:h-14 mb-3 sm:mb-5 ${isDark ? "text-white/70" : "text-black/70"}`}
                />
                {/* Glow effect when dragging */}
                {isDragging && (
                  <motion.div
                    className="absolute inset-0 blur-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    style={{
                      background: isDark
                        ? "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(0,0,0,0.2) 0%, transparent 70%)",
                      transform: "scale(1.5)",
                    }}
                  />
                )}
              </motion.div>
              <motion.p
                className={`text-base sm:text-xl font-medium ${isDark ? "text-white/90" : "text-black/90"}`}
                animate={{ y: isDragging ? -2 : 0 }}
              >
                {isDragActive ? "Drop files here" : "Drag and drop files here"}
              </motion.p>
              <p className={`mt-2 sm:mt-3 text-xs sm:text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>
                or click to select files
              </p>
            </motion.div>
          ) : (
            <div className="w-full h-full flex flex-col relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold text-base sm:text-lg ${isDark ? "text-white/90" : "text-black/90"}`}>
                  Selected Files ({selectedFiles.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFiles}
                  className={
                    isDark
                      ? "text-white/60 hover:text-white hover:bg-white/5"
                      : "text-black/60 hover:text-black hover:bg-black/5"
                  }
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Clear All</span>
                </Button>
              </div>

              <ScrollArea className="flex-1 w-full pr-4">
                <AnimatePresence initial={false}>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <motion.div
                        key={`file-${index}-${file.name}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: index * 0.05,
                        }}
                        whileHover={{
                          scale: 1.01,
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
                          boxShadow: isDark ? "0 0 15px rgba(0, 0, 0, 0.2)" : "0 0 15px rgba(0, 0, 0, 0.1)",
                        }}
                        className={`p-2 sm:p-3 rounded-lg flex items-center justify-between ${
                          isDark ? "glass" : "glass-light"
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                          <div
                            className={`p-1.5 sm:p-2 rounded-md ${
                              isDark ? "bg-white/5 text-white/80" : "bg-black/5 text-black/80"
                            }`}
                          >
                            <FileIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <p
                              className={`text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-[150px] lg:max-w-[200px] ${
                                isDark ? "text-white/90" : "text-black/90"
                              }`}
                            >
                              {file.name}
                            </p>
                            <p className={`text-[10px] sm:text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{
                            scale: 1.1,
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                          }}
                          whileTap={{ scale: 0.95 }}
                          className={`h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center rounded-full ${
                            isDark ? "text-white/50 hover:text-white/90" : "text-black/50 hover:text-black/90"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(index)
                          }}
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs sm:text-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    open()
                  }}
                >
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Add More Files
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default FileDropZone
