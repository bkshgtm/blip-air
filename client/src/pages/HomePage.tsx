"use client"

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Container, VStack, SimpleGrid, Heading, Text, Icon, Button, useColorModeValue, Box } from "@chakra-ui/react"
import { motion } from "framer-motion"
import { FileUp, Lock, Wifi, Zap, QrCode } from "lucide-react"
import { useSocketStore } from "../store/socketStore"
import { useUiStore } from "../store/uiStore"
import GlassCard from "../components/GlassCard"

const MotionBox = motion(Box)
const MotionHeading = motion(Heading)
const MotionText = motion(Text)
const MotionButton = motion(Button)

const HomePage = () => {
  const navigate = useNavigate()
  const { isConnected } = useSocketStore()
  const { openQrCodeModal } = useUiStore()

  const accentGradient = useColorModeValue("linear(to-br, brand.400, brand.600)", "linear(to-br, brand.300, brand.500)")

  const features = [
    {
      icon: Wifi,
      title: "Direct Connections",
      description: "Fast peer-to-peer transfers that work anywhere with automatic fallback when needed.",
    },
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "WebRTC's encryption keeps your files secure during transit.",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Peer-to-peer streams with minimum relay latency.",
    },
  ]

  useEffect(() => {
    if (!isConnected) {
    }
  }, [isConnected])

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* HERO */}
        <GlassCard w="full" p={10}>
          <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <VStack spacing={6} textAlign="center">
              <MotionHeading
                fontSize={{ base: "4xl", md: "6xl" }}
                fontWeight="black"
                letterSpacing="tighter"
                bgGradient="linear(to-r, brand.300, brand.400, brand.600)"
                bgClip="text"
                initial={{ opacity: 0, y: -20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  textShadow: [
                    "0 0 8px rgba(99, 102, 241, 0)",
                    "0 0 12px rgba(255, 255, 255, 0.3)",
                    "0 0 8px rgba(99, 102, 241, 0)",
                  ],
                }}
                transition={{
                  delay: 0.3,
                  duration: 1,
                  ease: "easeInOut",
                }}
              >
                BLIPAIR
              </MotionHeading>
              <MotionText
                fontSize="sm"
                maxW="2xl"
                opacity={0.8}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.3 }}
              >
                Send files directly between devices with matte-black glass panels, moving gradients, and end-to-end
                encryption—works anywhere with automatic connectivity assistance.
              </MotionText>
              <Box position="relative" zIndex="1">
                <MotionButton
                  size="lg"
                  leftIcon={<FileUp />}
                  variant="startSharing"
                  onClick={() => navigate("/transfer")}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ pointerEvents: "auto" }}
                >
                  Start Sharing
                </MotionButton>
              </Box>
            </VStack>
          </MotionBox>
        </GlassCard>

        {/* FEATURES */}
        <GlassCard w="full" p={10}>
          <MotionBox
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
              {features.map((f, i) => (
                <MotionBox
                  key={i}
                  textAlign="center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.3 }}
                  whileHover={{ y: -6, boxShadow: "2xl" }}
                >
                  <VStack spacing={4}>
                    <Icon as={f.icon} boxSize={10} color="brand.600" />
                    <Heading size="md">{f.title}</Heading>
                    <Text>{f.description}</Text>
                  </VStack>
                </MotionBox>
              ))}
            </SimpleGrid>
          </MotionBox>
        </GlassCard>

        {/* CTA */}
        <GlassCard w="full" p={10}>
          <MotionBox
            position={"absolute" as any}
            bottom={0}
            left="50%"
            height="100%"
            width="100%"
            bgGradient={accentGradient}
            opacity={0.1}
            borderRadius="3xl"
            filter="blur(80px)"
            transform="translate(-50%, 20%)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.12 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          />

          <MotionBox
            position="relative"
            p={8}
            borderRadius="2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <VStack spacing={4} textAlign="center">
              <MotionButton
                size="lg"
                variant="qrGlass"
                leftIcon={<QrCode />}
                onClick={openQrCodeModal}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Show My QR Code
              </MotionButton>
            </VStack>
          </MotionBox>
        </GlassCard>
      </VStack>
    </Container>
  )
}

export default HomePage
