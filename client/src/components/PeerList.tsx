"use client"

import { Box, Text, VStack, HStack, Avatar, Button, useColorModeValue, Badge, Divider, Heading } from "@chakra-ui/react"
import { motion } from "framer-motion"
import { Send } from "lucide-react"
import { useSocketStore } from "../store/socketStore"
import { useWebRTCStore } from "../store/webrtcStore"

const MotionBox = motion(Box)

const PeerList = () => {
  const { peers } = useSocketStore()
  const { selectedFiles, createPeerConnection, sendFiles } = useWebRTCStore()

  const bgColor = useColorModeValue("glass.200", "darkGlass.200")
  const borderColor = useColorModeValue("glass.300", "darkGlass.100")
  const peerItemBgColor = useColorModeValue("glass.100", "darkGlass.100")

  const handleSendFiles = async (peerId: string) => {
    // First ensure we have a connection
    await createPeerConnection(peerId)
    // Then send the files
    await sendFiles(peerId)
  }

  return (
    <VStack
      spacing={4}
      align="stretch"
      bg={bgColor}
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      p={4}
      height="100%"
      minH="300px"
    >
      <Heading size="md">Available Peers</Heading>
      <Divider />

      {peers.length === 0 ? (
        <VStack justify="center" align="center" height="100%" spacing={4} opacity={0.7}>
          <Text>No peers found on your network</Text>
          <Text fontSize="sm">Make sure other devices are connected to the same WiFi network</Text>
        </VStack>
      ) : (
        <VStack spacing={3} align="stretch" overflowY="auto">
          {peers.map((peerId) => (
            <MotionBox key={peerId} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <HStack p={3} borderRadius="lg" bg={peerItemBgColor} justify="space-between" boxShadow="sm">
                <HStack>
                  <Avatar size="sm" name={`Peer ${peerId.substring(0, 4)}`} bg="brand.400" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">Peer {peerId.substring(0, 8)}...</Text>
                    <Badge colorScheme="green" variant="subtle" fontSize="xs">
                      Online
                    </Badge>
                  </VStack>
                </HStack>

                <Button
                  size="sm"
                  leftIcon={<Send size={14} />}
                  colorScheme="brand"
                  isDisabled={selectedFiles.length === 0}
                  onClick={() => handleSendFiles(peerId)}
                >
                  Send
                </Button>
              </HStack>
            </MotionBox>
          ))}
        </VStack>
      )}
    </VStack>
  )
}

export default PeerList
