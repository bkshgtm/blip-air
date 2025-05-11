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

  const qrValue = JSON.stringify({
    sessionId,
    sessionName,
    pin,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bgGradient={bgGradient} borderRadius="2xl" boxShadow="xl" p={4}>
        <ModalHeader textAlign="center">Connect with QR Code</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="center" py={4}>
            <MotionBox
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
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
