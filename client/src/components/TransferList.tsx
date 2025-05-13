"use client"

import {
  Box,
  Text,
  VStack,
  HStack,
  Progress,
  IconButton,
  useColorModeValue,
  Badge,
  Divider,
  Heading,
  Button,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { Download, FileIcon, Pause, Play, X } from "lucide-react"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize, formatSpeed, formatTime } from "../lib/chunking"

const MotionBox = motion(Box)

const TransferList = () => {
  const { transfers, pauseTransfer, resumeTransfer, cancelTransfer, acceptTransfer, rejectTransfer } = useWebRTCStore()

  const bgColor = useColorModeValue("glass.200", "darkGlass.200")
  const borderColor = useColorModeValue("glass.300", "darkGlass.100")
  const itemBgColor = useColorModeValue("glass.100", "darkGlass.100")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "green"
      case "transferring":
        return "blue"
      case "paused":
        return "yellow"
      case "error":
        return "red"
      default:
        return "gray"
    }
  }

  return (
    <VStack
      spacing={4}
      align="stretch"
      bg={bgColor}
      borderRadius="xl"
      border="none"
      borderColor={borderColor}
      p={4}
      height="100%"
      minH="300px"
    >
      <HStack justify="space-between" align="center">
        <Heading size="md">Transfers</Heading>
        {transfers.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => useWebRTCStore.getState().clearAllTransfers()}>
            Clear All
          </Button>
        )}
      </HStack>
      <Divider />

      {transfers.length === 0 ? (
        <VStack justify="center" align="center" height="100%" spacing={4} opacity={0.7}>
          <Text>No active transfers</Text>
          <Text fontSize="sm">Select files and a peer to start transferring</Text>
        </VStack>
      ) : (
        <VStack spacing={4} align="stretch" overflowY="auto">
          {transfers.map((transfer) => (
            <MotionBox
              key={transfer.fileId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <VStack p={4} borderRadius="lg" bg={itemBgColor} align="stretch" spacing={3} boxShadow="sm">
                <HStack justify="space-between">
                  <HStack>
                    <FileIcon size={20} />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="medium" noOfLines={1}>
                        {transfer.fileName}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatFileSize(transfer.fileSize)}
                      </Text>
                    </VStack>
                  </HStack>

                  <Badge colorScheme={getStatusColor(transfer.status)}>{transfer.status}</Badge>
                </HStack>

                {transfer.status === "pending" && transfer.direction === "incoming" ? (
                  <HStack justify="flex-end" spacing={2}>
                    <Button
                      size="sm"
                      leftIcon={<Download size={14} />}
                      colorScheme="green"
                      onClick={() => acceptTransfer(transfer.fileId)}
                      _hover={{ filter: "brightness(95%)", transform: "translateY(-1px)" }}
                      transition="all 0.2s ease-out"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      leftIcon={<X size={14} />}
                      colorScheme="red"
                      variant="outline"
                      onClick={() => rejectTransfer(transfer.fileId)}
                    >
                      Reject
                    </Button>
                  </HStack>
                ) : (
                  <>
                    <Progress
                      value={transfer.progress * 100}
                      size="sm"
                      colorScheme="brand"
                      borderRadius="full"
                      isIndeterminate={transfer.status === "pending"}
                    />

                    <HStack justify="space-between">
                      <Text fontSize="xs">
                        {transfer.status === "transferring" && (
                          <>
                            {formatSpeed(transfer.speed)} • {formatTime(transfer.eta)} remaining
                          </>
                        )}
                        {transfer.status === "completed" && transfer.direction === "outgoing" && "Transfer complete"}
                        {transfer.status === "completed" && transfer.direction === "incoming" && "File received"}
                        {transfer.status === "paused" && "Transfer paused"}
                        {transfer.status === "error" && transfer.error}
                      </Text>

                      <HStack>
                        {transfer.status === "completed" && transfer.direction === "incoming" && (
                          <IconButton
                            aria-label="Download file"
                            icon={<Download size={16} />}
                            size="xs"
                            colorScheme="green"
                            _hover={{ filter: "brightness(95%)", transform: "translateY(-1px)" }}
                            transition="all 0.2s ease-out"
                            onClick={async () => {
                              if (transfer.fileBlob) {
                                const url = URL.createObjectURL(transfer.fileBlob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = transfer.fileName || "download"
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                              } else if (transfer.usesFileSystemAccessAPI && transfer.fileHandle) {
                                try {
                                  const file = await transfer.fileHandle.getFile()
                                  const url = URL.createObjectURL(file)
                                  const a = document.createElement("a")
                                  a.href = url
                                  a.download = transfer.fileName || "download"
                                  document.body.appendChild(a)
                                  a.click()
                                  document.body.removeChild(a)
                                  URL.revokeObjectURL(url)
                                } catch (err) {
                                  console.error("Error downloading file:", err)
                                }
                              }
                            }}
                          />
                        )}
                        {transfer.status !== "completed" &&
                          transfer.status !== "error" &&
                          transfer.direction === "outgoing" && (
                            <>
                              {transfer.status === "transferring" ? (
                                <IconButton
                                  aria-label="Pause transfer"
                                  icon={<Pause size={16} />}
                                  size="xs"
                                  onClick={() => pauseTransfer(transfer.fileId)}
                                />
                              ) : (
                                <IconButton
                                  aria-label="Resume transfer"
                                  icon={<Play size={16} />}
                                  size="xs"
                                  onClick={() => resumeTransfer(transfer.fileId)}
                                />
                              )}
                            </>
                          )}

                        {transfer.status !== "completed" && (
                          <IconButton
                            aria-label="Cancel transfer"
                            icon={<X size={16} />}
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            onClick={() => cancelTransfer(transfer.fileId)}
                          />
                        )}
                      </HStack>
                    </HStack>
                  </>
                )}
              </VStack>
            </MotionBox>
          ))}
        </VStack>
      )}
    </VStack>
  )
}

export default TransferList
