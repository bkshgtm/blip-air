"use client"

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Container,
  VStack,
  SimpleGrid,
  Heading,
  Text,
  Icon,
  Button,
  useColorModeValue,
  Box, // Added Box import
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { FileUp, Lock, Wifi, Zap, QrCode } from "lucide-react" // Added QrCode icon
import { useSocketStore } from "../store/socketStore"
import { useUiStore } from "../store/uiStore" // Added uiStore
import GlassCard from "../components/GlassCard"

const MotionBox = motion(Box) // Changed from motion("div") to motion(Box)
const MotionHeading = motion(Heading)
const MotionText = motion(Text)
const MotionButton = motion(Button)

const HomePage = () => {
  const navigate = useNavigate()
  const { isConnected } = useSocketStore()
  const { openQrCodeModal } = useUiStore() // Get openQrCodeModal from uiStore

  const accentGradient = useColorModeValue( // Define accentGradient
    "linear(to-br, brand.400, brand.600)",
    "linear(to-br, brand.300, brand.500)"
  );

  const ctaGradient = useColorModeValue(
    "linear(to-br, matte.200, matte.300)",
    "linear(to-br, matte.300, matte.400)"
  )

  const features = [
    {
      icon: Wifi,
      title: "LAN Only",
      description: "Transfers stay on your network—no internet, no servers.",
    },
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "AES-GCM keeps your files locked tight during transit.",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Peer-to-peer streams with zero relay latency.",
    },
  ]

  useEffect(() => {
    if (!isConnected) {
      // optional toast or reconnect
    }
  }, [isConnected])

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* HERO */}
        <GlassCard w="full" p={10}>
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} // Faster: 0.6 -> 0.4
          >
            <VStack spacing={6} textAlign="center">
              <MotionHeading
                size="2xl"
                bgGradient="linear(to-r, brand.600, brand.400)"
                bgClip="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }} // Added duration, slightly faster delay
              >
                Secure P2P File Sharing
              </MotionHeading>
              <MotionText
                fontSize="lg"
                maxW="2xl"
                opacity={0.8}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.3 }} // Added duration, slightly faster delay
              >
                Send files directly over your LAN with matte-black glass panels,
                moving gradients, and end-to-end encryption—no limits, no middlemen.
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
                  style={{ pointerEvents: 'auto' }}
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
            transition={{ delay: 0.5, duration: 0.4 }} // Faster: delay 0.8->0.5, duration 0.6->0.4
          >
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
              {features.map((f, i) => (
                <MotionBox
                  key={i}
                  textAlign="center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.3 }} // Faster: base delay 0.8->0.5, increment 0.2->0.15, duration 0.5->0.3
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
        <GlassCard w="full" p={10}> {/* This GlassCard provides the adaptive base background */}
          {/* Decorative gradient like on TransferPage cards */}
          <MotionBox
            position={"absolute" as any}
            bottom={0} // Example positioning, can be adjusted
            left="50%"
            height="100%" // Make it cover more area for a CTA
            width="100%"
            bgGradient={accentGradient} // Use the adaptive accentGradient
            opacity={0.1} // Slightly more visible for CTA
            borderRadius="3xl" // Or inherit from GlassCard
            filter="blur(80px)" // Larger blur
            transform="translate(-50%, 20%)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.12 }} // Control final opacity
            transition={{ delay: 0.3, duration: 0.7 }} // Adjusted timings
          />
          {/* Content Box - remove its specific dark gradient, keep padding & border radius */}
          <MotionBox
            position="relative" // Ensure content is above the decorative gradient
            p={8}
            borderRadius="2xl" // This might be redundant if GlassCard handles it, but fine for structure
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }} // Faster: delay 1.2->0.7, duration 0.8->0.5
          >
            <VStack spacing={4} textAlign="center">
              <Heading size="lg">Ready to share files?</Heading>
              <Text opacity={0.8}>
                No sign-ups, no servers—just connect to the same WiFi and go.
              </Text>
              <MotionButton
                size="lg"
                variant="qrGlass" // Using new qrGlass variant
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
