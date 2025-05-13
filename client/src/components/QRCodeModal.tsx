"use client"

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
  VStack,
  useColorModeValue,
  Box,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { useSettingsStore } from "../store/settingsStore"
import { useSocketStore } from "../store/socketStore"

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
}

const MotionBox = motion(Box)

const QRCodeModal = ({ isOpen, onClose }: QRCodeModalProps) => {
  const { sessionName, pin } = useSettingsStore()
  const { sessionId } = useSocketStore()

  const bgGradient = useColorModeValue("linear(to-br, purple.50, blue.50)", "linear(to-br, gray.800, purple.900)")

  let qrValue = ""
  if (typeof window !== "undefined") {
    const baseUrl = window.location.origin
    const params = new URLSearchParams()
    if (sessionId) {
      params.append("connectToPeerId", sessionId)
    }
    if (sessionName) {
      params.append("sessionNameLabel", sessionName)
    }

    qrValue = `${baseUrl}/transfer${params.toString() ? `?${params.toString()}` : ""}`
  } else {
    qrValue = "Error: Could not generate QR code URL."
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.600" />
      <ModalContent
        p={8}
        overflow="hidden"
        borderWidth="1px"
        borderColor={useColorModeValue("rgba(230,235,240,0.3)", "rgba(60,70,80,0.3)")}
        borderRadius="xl"
        position="relative"
        bg={useColorModeValue("rgba(255,255,255,0.2)", "rgba(0,0,0,0.2)")}
        backdropFilter="blur(12px)"
      >
        <Box
          position="absolute"
          bottom={0}
          left="50%"
          height="80%"
          width="80%"
          bgGradient={bgGradient}
          opacity={0.15}
          borderRadius="3xl"
          filter="blur(60px)"
          transform="translate(-50%, 30%)"
        />
        <ModalHeader textAlign="center" px={0}>
          Connect with QR Code
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody position="relative" px={0}>
          <VStack spacing={4} align="center" py={4}>
            <MotionBox
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "tween", duration: 0.3 }}
              p={4}
              bg="white"
              borderRadius="xl"
              boxShadow="md"
            >
              <QRCodeSVG
                value={qrValue}
                size={200}
                level="H"
                includeMargin
                imageSettings={{
                  src: "/logo.png",
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </MotionBox>
            <VStack spacing={1}>
              <Text fontWeight="bold">Session: {sessionName}</Text>
              <Text>PIN: {pin}</Text>
              {sessionId && <Text fontSize="sm">ID: {sessionId.substring(0, 8)}...</Text>}
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default QRCodeModal
