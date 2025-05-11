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
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { FileUp, Lock, Wifi, Zap } from "lucide-react"
import { useSocketStore } from "../store/socketStore"
import GlassCard from "../components/GlassCard"

const MotionBox = motion("div")
const MotionHeading = motion(Heading)
const MotionText = motion(Text)
const MotionButton = motion(Button)

const HomePage = () => {
  const navigate = useNavigate()
  const { isConnected } = useSocketStore()

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
            transition={{ duration: 0.6 }}
          >
            <VStack spacing={6} textAlign="center">
              <MotionHeading
                size="2xl"
                bgGradient="linear(to-r, brand.600, brand.400)"
                bgClip="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Secure P2P File Sharing
              </MotionHeading>
              <MotionText
                fontSize="lg"
                maxW="2xl"
                opacity={0.8}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Send files directly over your LAN with matte-black glass panels,
                moving gradients, and end-to-end encryption—no limits, no middlemen.
              </MotionText>
              <MotionButton
                size="lg"
                leftIcon={<FileUp />}
                variant="ghostGlass"
                onClick={() => navigate("/transfer")}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Sharing
              </MotionButton>
            </VStack>
          </MotionBox>
        </GlassCard>

        {/* FEATURES */}
        <GlassCard w="full" p={10}>
          <MotionBox
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
              {features.map((f, i) => (
                <MotionBox
                  key={i}
                  textAlign="center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.2, duration: 0.5 }}
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
            bgGradient={ctaGradient}
            p={8}
            borderRadius="2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <VStack spacing={4} textAlign="center">
              <Heading size="lg">Ready to share files?</Heading>
              <Text opacity={0.8}>
                No sign-ups, no servers—just connect to the same WiFi and go.
              </Text>
              <MotionButton
                size="lg"
                variant="solid"
                onClick={() => navigate("/transfer")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Go to Transfer
              </MotionButton>
            </VStack>
          </MotionBox>
        </GlassCard>
      </VStack>
    </Container>
  )
}

export default HomePage
