"use client"

import React from "react"
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { useSettingsStore } from "../store/settingsStore"
import { formatFileSize } from "../lib/chunking"
import GlassCard from "../components/GlassCard"

const MotionBox = motion(Box)

const SettingsPage: React.FC = () => {
  const {
    sessionName,
    pin,
    darkMode,
    chunkSize,
    useCompression,
    setSessionName,
    setPin,
    toggleDarkMode,
    setChunkSize,
    toggleCompression,
  } = useSettingsStore()

  const headingColor = useColorModeValue("gray.100", "whiteAlpha.900")
  const accentColor = useColorModeValue("brand.500", "accent")

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={8} align="stretch">
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Heading size="2xl" mb={6} color={headingColor} textAlign="center">
            Settings
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            {/* Profile Settings */}
            <GlassCard>
              <Heading size="md" mb={4}>
                Profile Settings
              </Heading>
              <VStack spacing={6} align="stretch">
                <FormControl>
                  <FormLabel>Session Name</FormLabel>
                  <Input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Enter a name for your session"
                    variant="filled"
                    bg="rgba(255,255,255,0.06)"
                    _hover={{ bg: "rgba(255,255,255,0.1)" }}
                    color="white"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>PIN Code</FormLabel>
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter a PIN for secure connections"
                    maxLength={4}
                    variant="filled"
                    bg="rgba(255,255,255,0.06)"
                    _hover={{ bg: "rgba(255,255,255,0.1)" }}
                    color="white"
                  />
                  <Text fontSize="sm" color="whiteAlpha.600" mt={1}>
                    Required for other devices to connect
                  </Text>
                </FormControl>
              </VStack>
            </GlassCard>

            {/* Appearance & Performance Settings */}
            <GlassCard>
              <Heading size="md" mb={4}>
                Appearance & Performance
              </Heading>
              <VStack spacing={6} align="stretch">
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="dark-mode" mb="0">
                    Dark Mode
                  </FormLabel>
                  <Switch
                    id="dark-mode"
                    isChecked={darkMode}
                    onChange={toggleDarkMode}
                    colorScheme="brand"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Chunk Size: {formatFileSize(chunkSize)}</FormLabel>
                  <Slider
                    min={16 * 1024}
                    max={256 * 1024}
                    step={16 * 1024}
                    value={chunkSize}
                    onChange={setChunkSize}
                    colorScheme="brand"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb boxSize={6} />
                  </Slider>
                  <Text fontSize="sm" color="whiteAlpha.600" mt={1}>
                    Smaller chunks help unstable networks
                  </Text>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="compression" mb="0">
                    Use Compression
                  </FormLabel>
                  <Switch
                    id="compression"
                    isChecked={useCompression}
                    onChange={toggleCompression}
                    colorScheme="brand"
                  />
                </FormControl>
              </VStack>
            </GlassCard>
          </SimpleGrid>

          <Box mt={10} textAlign="center">
            <Button
              colorScheme="brand"
              size="lg"
              px={8}
              _hover={{ boxShadow: `0 0 20px ${accentColor}` }}
            >
              Save Settings
            </Button>
          </Box>
        </MotionBox>
      </VStack>
    </Container>
  )
}

export default SettingsPage
