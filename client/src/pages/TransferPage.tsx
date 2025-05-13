"use client"

import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import {
  Container,
  VStack,
  SimpleGrid,
  Box,
  Heading,
  Text,
  Icon,
  Flex,
  Badge,
  useToast,
  useColorModeValue,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { FileUp, Download, Users, Activity, Shield } from "lucide-react"
import GlassCard from "../components/GlassCard"
import FileDropZone from "../components/FileDropZone"
import PeerList from "../components/PeerList"
import TransferList from "../components/TransferList"
import TransferStats from "../components/TransferStats"
import { useSocketStore } from "../store/socketStore"
import { useWebRTCStore } from "../store/webrtcStore"
import { useSettingsStore } from "../store/settingsStore"

const MotionCard = motion(GlassCard)
const MotionBox = motion(Box)
const MotionFlex = motion(Flex)

const TransferPage = () => {
  const toast = useToast({ position: "bottom" })
  const { isConnected, sessionId, peers } = useSocketStore()
  const { sessionName } = useSettingsStore()
  const { transfers, createPeerConnection } = useWebRTCStore()
  const location = useLocation()

  const accentGradient = useColorModeValue("linear(to-br, brand.400, brand.600)", "linear(to-br, brand.300, brand.500)")

  const secondaryGradient = useColorModeValue(
    "linear(to-br, matte.200, matte.300)",
    "linear(to-br, matte.300, matte.400)",
  )

  const cardHoverBg = useColorModeValue("rgba(255,255,255,0.1)", "rgba(0,0,0,0.1)")
  const statusBg = useColorModeValue("rgba(255,255,255,0.9)", "rgba(20,20,20,0.8)")
  const highlightColor = useColorModeValue("brand.500", "brand.300")
  const cardBorderColor = useColorModeValue("rgba(230,235,240,0.3)", "rgba(60,70,80,0.3)")
  const softBgHover = useColorModeValue("rgba(245,248,252,0.5)", "rgba(30,35,45,0.5)")
  const peerListBorderColor = useColorModeValue("rgba(230,235,240,0.2)", "rgba(60,70,80,0.2)")
  const statsSeparatorBg = useColorModeValue("rgba(230,235,240,0.4)", "rgba(60,70,80,0.4)")
  const transferListBorderColor = useColorModeValue("rgba(230,235,240,0.2)", "rgba(60,70,80,0.2)")

  useEffect(() => {
    const done = transfers.filter((t) => t.status === "completed" && !t._notified)
    const failed = transfers.filter((t) => t.status === "error" && !t._notified)

    done.forEach((t) => {
      toast({
        title: "Transfer Complete",
        description: `${t.fileName} ${t.direction === "incoming" ? "received" : "sent"} successfully.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      })
      t._notified = true
    })

    failed.forEach((t) => {
      toast({
        title: "Transfer Failed",
        description: t.error ?? "Unknown error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
      t._notified = true
    })
  }, [transfers, toast])

  const activeTransfers = transfers.filter((t) => t.status === "transferring").length
  const completedTransfers = transfers.filter((t) => t.status === "completed").length
  const prevOutgoingActiveTransfersRef = useRef(0)
  const prevIncomingPendingTransfersRef = useRef(0)

  useEffect(() => {
    const currentOutgoingActiveTransfers = transfers.filter(
      (t) => t.direction === "outgoing" && (t.status === "pending" || t.status === "transferring"),
    ).length

    const currentIncomingPendingTransfers = transfers.filter(
      (t) => t.direction === "incoming" && t.status === "pending",
    ).length

    const newOutgoingStarted = currentOutgoingActiveTransfers > prevOutgoingActiveTransfersRef.current
    const newIncomingOfferReceived = currentIncomingPendingTransfers > prevIncomingPendingTransfersRef.current

    if (newOutgoingStarted || newIncomingOfferReceived) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight })
      })
    }

    prevOutgoingActiveTransfersRef.current = currentOutgoingActiveTransfers
    prevIncomingPendingTransfersRef.current = currentIncomingPendingTransfers
  }, [transfers])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const peerIdFromQr = params.get("connectToPeerId")

    if (peerIdFromQr && peerIdFromQr !== sessionId) {
      createPeerConnection(peerIdFromQr)
    }
  }, [location.search, createPeerConnection, toast, sessionId])

  const featureCardStyles = {
    p: 8,
    overflow: "hidden",
    borderWidth: "1px",
    borderColor: cardBorderColor,
    borderRadius: "xl",
    transition: { duration: 0.2, ease: "easeOut" },
    _hover: {
      boxShadow: "xl",
      bg: cardHoverBg,
      transform: "translateY(-4px)",
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay, duration: 0.3 },
    }),
  }

  const headingVariants = {
    hidden: { opacity: 0 },
    visible: (delay: number) => ({
      opacity: 1,
      transition: { delay, duration: 0.25 },
    }),
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={10} align="stretch">
        {/* Connection Status */}
        <MotionCard
          p={4}
          borderRadius="xl"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={cardVariants}
          overflow="hidden"
          position={"relative" as any}
          maxWidth="fit-content"
          mx="auto"
        >
          <MotionFlex
            align="center"
            justify="center"
            bg={statusBg}
            p={2}
            borderRadius="2xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            boxShadow="md"
            width="100%"
          >
            <Badge
              colorScheme={isConnected && sessionId ? "green" : "red"}
              variant="solid"
              borderRadius="2xl"
              px={3}
              py={1}
            >
              {isConnected && sessionId ? "Connected" : "Disconnected"}
            </Badge>

            {isConnected && sessionId && (
              <Text ml={3} fontSize="sm" opacity={0.8}>
                Session ID: {sessionId.slice(0, 8)}...
              </Text>
            )}
          </MotionFlex>
        </MotionCard>

        {/* Quick Stats Bar */}
        <MotionCard p={5} borderRadius="xl" initial="hidden" animate="visible" custom={0.2} variants={cardVariants}>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={5}>
            <Flex align="center">
              <Icon as={Users} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>
                  Available Peers
                </Text>
                <Text fontSize="xl" fontWeight="bold">
                  {peers.length}
                </Text>
              </Box>
            </Flex>

            <Flex align="center">
              <Icon as={Activity} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>
                  Active Transfers
                </Text>
                <Text fontSize="xl" fontWeight="bold">
                  {activeTransfers}
                </Text>
              </Box>
            </Flex>

            <Flex align="center">
              <Icon as={Download} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>
                  Completed
                </Text>
                <Text fontSize="xl" fontWeight="bold">
                  {completedTransfers}
                </Text>
              </Box>
            </Flex>
          </SimpleGrid>
        </MotionCard>

        {/* Main Content Grid */}
        <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6}>
          <MotionCard
            {...featureCardStyles}
            position={"relative" as any}
            gridColumn={{ lg: "span 7" }}
            initial="hidden"
            animate="visible"
            custom={0.3}
            variants={cardVariants}
          >
            <MotionBox
              position={"absolute" as any}
              bottom={0}
              left="50%"
              height="80%"
              width="80%"
              bgGradient={accentGradient}
              opacity={0.08}
              borderRadius="3xl"
              filter="blur(60px)"
              transform="translate(-50%, 30%)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 0.3, duration: 0.7 }}
            />

            <MotionFlex
              align="center"
              mb={6}
              initial="hidden"
              animate="visible"
              custom={0.4}
              variants={headingVariants}
            >
              <Icon as={FileUp} mr={3} color={highlightColor} boxSize={6} />
              <Heading size="md">Select Files to Share</Heading>
            </MotionFlex>

            <FileDropZone />
          </MotionCard>

          <MotionCard
            {...featureCardStyles}
            _hover={{}}
            transition={{ duration: 0 }}
            borderWidth={0}
            position={"relative" as any}
            gridColumn={{ lg: "span 5" }}
            initial="hidden"
            animate="visible"
            custom={0.4}
            variants={cardVariants}
          >
            <MotionBox
              position={"absolute" as any}
              top={0}
              right={0}
              height="50%"
              width="50%"
              bgGradient={accentGradient}
              opacity={0.08}
              borderRadius="full"
              filter="blur(40px)"
              transform="translate(30%, -30%)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 0.4, duration: 0.7 }}
            />

            <MotionFlex
              align="center"
              mb={6}
              initial="hidden"
              animate="visible"
              custom={0.5}
              variants={headingVariants}
            >
              <Icon as={Users} mr={3} color={highlightColor} boxSize={6} />
              <Heading size="md">Available Peers</Heading>
            </MotionFlex>
            <Text mb={2} fontSize="sm" opacity={0.8}>
              Your Name: {sessionName}
            </Text>
            <PeerList />

            <Box mt={4} className="custom-peer-styling">
              <style>{`
                .custom-peer-styling table,
                .custom-peer-styling tr,
                .custom-peer-styling td,
                .custom-peer-styling th {
                  border: none !important;
                  border-collapse: collapse !important;
                }

                .custom-peer-styling tr {
                  border-bottom: 1px solid ${peerListBorderColor} !important;
                }

                .custom-peer-styling tr:last-child {
                  border-bottom: none !important;
                }
                
                .custom-peer-styling * {
                  box-shadow: none !important;
                }
                
                .custom-peer-styling tr:hover {
                  background: ${softBgHover} !important;
                  border-radius: 8px !important;
                }
              `}</style>
            </Box>
          </MotionCard>
        </SimpleGrid>

        {/* Stats */}
        {transfers.length > 0 && (
          <MotionCard
            id="transfer-stats"
            {...featureCardStyles}
            _hover={{}}
            transition={{ duration: 0 }}
            position={"relative" as any}
            initial="hidden"
            animate="visible"
            custom={0.5}
            variants={cardVariants}
          >
            <MotionBox
              position={"absolute" as any}
              bottom={0}
              right={0}
              height="80%"
              width="40%"
              bgGradient={secondaryGradient}
              opacity={0.08}
              borderRadius="full"
              filter="blur(60px)"
              transform="translate(30%, 30%)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 0.5, duration: 0.7 }}
            />

            <MotionFlex
              align="center"
              mb={6}
              initial="hidden"
              animate="visible"
              custom={0.6}
              variants={headingVariants}
            >
              <Icon as={Activity} mr={3} color={highlightColor} boxSize={6} />
              <Heading size="md">Transfer Statistics</Heading>
            </MotionFlex>

            <TransferStats />

            {/* Custom styling to remove any unwanted lines */}
            <Box className="custom-stats-styling">
              <style>{`
                .custom-stats-styling table,
                .custom-stats-styling tr,
                .custom-stats-styling td,
                .custom-stats-styling th {
                  border: none !important;
                }
                
                .custom-stats-styling hr,
                .custom-stats-styling [role="separator"] {
                  border: none !important;
                  height: 1px !important;
                  background: linear-gradient(to right, transparent, ${statsSeparatorBg}, transparent) !important;
                  margin: 0.5rem 0 !important;
                }
              `}</style>
            </Box>
          </MotionCard>
        )}

        {/* Transfer History */}
        <MotionCard
          id="transfer-history"
          {...featureCardStyles}
          _hover={{}}
          transition={{ duration: 0 }}
          borderWidth={0}
          position={"relative" as any}
          initial="hidden"
          animate="visible"
          custom={0.6}
          variants={cardVariants}
        >
          <MotionBox
            position={"absolute" as any}
            top={0}
            left={0}
            height="50%"
            width="50%"
            bgGradient={accentGradient}
            opacity={0.08}
            borderRadius="full"
            filter="blur(40px)"
            transform="translate(-30%, -30%)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ delay: 0.6, duration: 0.7 }}
          />

          <MotionFlex align="center" mb={6} initial="hidden" animate="visible" custom={0.7} variants={headingVariants}>
            <Icon as={Download} mr={3} color={highlightColor} boxSize={6} />
            <Heading size="md">Transfer History</Heading>
          </MotionFlex>

          <TransferList />

          <Box mt={4} className="custom-transfer-styling">
            <style>{`
                .custom-transfer-styling table,
                .custom-transfer-styling tr,
                .custom-transfer-styling td,
                .custom-transfer-styling th {
                  border: none !important;
                  border-collapse: collapse !important;
                }

                .custom-transfer-styling tr {
                  border-bottom: 1px solid ${transferListBorderColor} !important;
                }

                .custom-transfer-styling tr:last-child {
                  border-bottom: none !important;
                }
                
                .custom-transfer-styling * {
                  box-shadow: none !important;
                }
                
                .custom-transfer-styling tr:hover {
                  background: ${softBgHover} !important;
                  border-radius: 8px !important;
                }
                
                .custom-transfer-styling hr,
                .custom-transfer-styling [role="separator"] {
                  border: none !important;
                  height: 1px !important;
                  background: linear-gradient(to right, transparent, ${statsSeparatorBg}, transparent) !important; 
                  margin: 0.5rem 0 !important;
                }
              `}</style>
          </Box>
        </MotionCard>
      </VStack>
    </Container>
  )
}

export default TransferPage
