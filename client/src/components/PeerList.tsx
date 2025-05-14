"use client"

import { Box, Text, VStack, HStack, Button, useColorModeValue, Badge, Divider, Heading, Icon } from "@chakra-ui/react"
import { Send, UserCircle } from "lucide-react"
import { useSocketStore } from "../store/socketStore"
import { useWebRTCStore } from "../store/webrtcStore"

const PeerList = () => {
  const { peers } = useSocketStore()
  const { selectedFiles, createPeerConnection, sendFiles } = useWebRTCStore()

  const bgColor = useColorModeValue("glass.200", "darkGlass.200")
  const borderColor = useColorModeValue("glass.300", "darkGlass.100")
  const peerItemBgColor = useColorModeValue("glass.100", "darkGlass.100")

  // Button colors
  const buttonBg = useColorModeValue("brand.50", "brand.900")
  const buttonColor = useColorModeValue("brand.600", "brand.100")
  const buttonBorderColor = useColorModeValue("brand.200", "brand.700")
  const buttonHoverBg = useColorModeValue("brand.100", "brand.800")
  const buttonActiveBg = useColorModeValue("brand.200", "brand.700")

  const handleSendFiles = async (peerId: string) => {
    await createPeerConnection(peerId)

    await sendFiles(peerId)
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
      <Heading size="md">Available Peers</Heading>
      <Divider />

      {peers.length === 0 ? (
        <VStack justify="center" align="center" height="100%" spacing={4} opacity={0.7}>
          <Text>No peers found on your network</Text>
          <Text fontSize="sm">Make sure other devices are connected to the same WiFi network</Text>
        </VStack>
      ) : (
        <VStack spacing={3} align="stretch" overflowY="auto">
          {peers.map((peer) => (
            <Box key={peer.id}>
              <HStack p={3} borderRadius="lg" bg={peerItemBgColor} justify="space-between" boxShadow="sm">
                <HStack>
                  {/* Replace Avatar with a generic icon */}
                  <Icon as={UserCircle} w={6} h={6} color={`hsl(${peer.id.charCodeAt(0) % 360}, 70%, 70%)`} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="medium">{peer.name}</Text>
                    <Badge colorScheme="green" variant="subtle" fontSize="xs">
                      Online
                    </Badge>
                  </VStack>
                </HStack>

                <Button
                  size="sm"
                  leftIcon={<Send size={14} />}
                  variant="solid"
                  bg={buttonBg}
                  color={buttonColor}
                  border="1px solid"
                  borderColor={buttonBorderColor}
                  _hover={{
                    bg: buttonHoverBg,
                    transform: "translateY(-1px)",
                    boxShadow: "sm",
                  }}
                  _active={{
                    bg: buttonActiveBg,
                    transform: "translateY(0)",
                  }}
                  _disabled={{
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                  transition="all 0.2s ease"
                  isDisabled={selectedFiles.length === 0}
                  onClick={() => handleSendFiles(peer.id)}
                >
                  Send
                </Button>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </VStack>
  )
}

export default PeerList
