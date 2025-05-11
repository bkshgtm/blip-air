"use client"

import { useEffect } from "react"
import { 
  Container, 
  VStack, 
  SimpleGrid, 
  Box, 
  Heading, 
  Text,
  Icon,
  Button,
  Flex,
  Badge,
  useToast,
  useColorModeValue
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

// Custom styled divider
const SoftDivider = ({ ...props }) => (
  <Box
    height="1px"
    width="100%"
    bgGradient="linear(to-r, transparent, whiteAlpha.300, transparent)"
    my={3}
    {...props}
  />
)

const MotionCard = motion(GlassCard)
const MotionHeading = motion(Heading)
const MotionBox = motion(Box)
const MotionFlex = motion(Flex)
const MotionText = motion(Text)

const TransferPage = () => {
  const toast = useToast()
  const { isConnected, sessionId } = useSocketStore()
  const { transfers } = useWebRTCStore()
  
  // Color mode values
  const accentGradient = useColorModeValue(
    "linear(to-br, brand.400, brand.600)",
    "linear(to-br, brand.300, brand.500)"
  )
  
  const secondaryGradient = useColorModeValue(
    "linear(to-br, matte.200, matte.300)",
    "linear(to-br, matte.300, matte.400)"
  )
  
  const cardHoverBg = useColorModeValue("rgba(255,255,255,0.9)", "rgba(30,30,40,0.8)")
  const statusBg = useColorModeValue("rgba(255,255,255,0.9)", "rgba(20,20,20,0.8)")
  const highlightColor = useColorModeValue("brand.500", "brand.300")
  const cardBorderColor = useColorModeValue("rgba(230,235,240,0.3)", "rgba(60,70,80,0.3)")
  const softBorderColor = useColorModeValue("rgba(230,235,240,0.1)", "rgba(60,70,80,0.1)")
  const softTextColor = useColorModeValue("gray.600", "gray.300")
  const softBgHover = useColorModeValue("rgba(245,248,252,0.5)", "rgba(30,35,45,0.5)")
  
  // Notifications
  useEffect(() => {
    const done = transfers.filter(t => t.status === "completed" && !t._notified)
    const failed = transfers.filter(t => t.status === "error" && !t._notified)
    
    done.forEach(t => {
      toast({
        title: "Transfer Complete",
        description: `${t.fileName} ${t.direction === "incoming" ? "received" : "sent"} successfully.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      })
      t._notified = true
    })
    
    failed.forEach(t => {
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

  // Quick stats
  const activeTransfers = transfers.filter(t => t.status === "transferring").length
  const completedTransfers = transfers.filter(t => t.status === "completed").length
  
  // Common card styles
  const featureCardStyles = {
    p: 8,
    overflow: "hidden",
    borderWidth: "1px",
    borderColor: cardBorderColor,
    borderRadius: "xl",
    transition: { duration: 0.3, ease: "easeOut" },
    _hover: {
      boxShadow: "xl",
      borderColor: highlightColor,
      bg: cardHoverBg,
      transform: "translateY(-4px)"
    }
  }
  
  // Animation variants for consistent transitions
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay, duration: 0.5 }
    })
  }
  
  const headingVariants = {
    hidden: { opacity: 0 },
    visible: (delay: number) => ({
      opacity: 1,
      transition: { delay, duration: 0.4 }
    })
  }
  
  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={10} align="stretch">
        {/* Header Section */}
        <MotionCard
          p={8}
          borderRadius="xl"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={cardVariants}
          overflow="hidden"
          position={"relative" as any}
        >
          <MotionBox
            position={"absolute" as any}
            top={0}
            right={0}
            height="100%"
            width="40%"
            bgGradient={accentGradient}
            opacity={0.1}
            borderRadius="full"
            filter="blur(60px)"
            transform="translate(30%, -30%)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            transition={{ delay: 0.3, duration: 1 }}
          />
          
          <Flex direction={{ base: "column", md: "row" }} align="center" justify="space-between">
            <Box>
              <MotionHeading
                size="xl"
                bgGradient={accentGradient}
                bgClip="text"
                mb={2}
                initial="hidden"
                animate="visible"
                custom={0.2}
                variants={headingVariants}
              >
                Secure File Transfer
              </MotionHeading>
              
              <MotionText
                opacity={0.8}
                mb={4}
                maxW="lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ delay: 0.4 }}
              >
                Send files directly over your LAN with end-to-end encryption — no size limits,
                no middlemen, complete privacy.
              </MotionText>
            </Box>
            
            <MotionFlex 
              align="center" 
              bg={statusBg}
              p={3}
              borderRadius="2xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              boxShadow="md"
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
          </Flex>
          
          {!isConnected && (
            <Box p={4} bg="red.500" color="white" borderRadius="xl" mt={4}>
              <Flex align="center">
                <Icon as={Shield} mr={2} />
                <Text>Not connected to signaling server. Please check your network.</Text>
              </Flex>
            </Box>
          )}
          
          {isConnected && !sessionId && (
            <Box p={4} bg="yellow.500" color="white" borderRadius="xl" mt={4}>
              <Flex align="center">
                <Icon as={Activity} mr={2} />
                <Text>Connecting to signaling server...</Text>
              </Flex>
            </Box>
          )}
        </MotionCard>

        {/* Quick Stats Bar */}
        <MotionCard
          p={5}
          borderRadius="xl"
          initial="hidden"
          animate="visible"
          custom={0.2}
          variants={cardVariants}
        >
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={5}>
            <Flex align="center">
              <Icon as={Users} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>Available Peers</Text>
                <Text fontSize="xl" fontWeight="bold">-</Text>
              </Box>
            </Flex>
            
            <Flex align="center">
              <Icon as={Activity} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>Active Transfers</Text>
                <Text fontSize="xl" fontWeight="bold">{activeTransfers}</Text>
              </Box>
            </Flex>
            
            <Flex align="center">
              <Icon as={Download} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>Completed</Text>
                <Text fontSize="xl" fontWeight="bold">{completedTransfers}</Text>
              </Box>
            </Flex>
            
            <Flex align="center">
              <Icon as={Shield} boxSize={6} color={highlightColor} mr={3} />
              <Box>
                <Text fontSize="sm" opacity={0.7}>Encryption</Text>
                <Text fontSize="xl" fontWeight="bold">AES-GCM</Text>
              </Box>
            </Flex>
          </SimpleGrid>
        </MotionCard>

        {/* Main Content Grid */}
        <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6}>
          {/* Drop Zone - Spans 7 columns on large screens */}
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
              transition={{ delay: 0.5, duration: 1 }}
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
          
          {/* Available Peers - Spans 5 columns on large screens */}
          <MotionCard
            {...featureCardStyles}
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
              bgGradient={secondaryGradient}
              opacity={0.08}
              borderRadius="full"
              filter="blur(40px)"
              transform="translate(30%, -30%)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 0.6, duration: 1 }}
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
            
            <PeerList />
            
            {/* This component might need to be modified in the actual implementation */}
            <Box mt={4} className="custom-peer-styling">
              {/* Custom styling to override any sharp lines in PeerList component */}
              <style>{`
                .custom-peer-styling table,
                .custom-peer-styling tr,
                .custom-peer-styling td,
                .custom-peer-styling th {
                  border: none !important;
                  border-collapse: collapse !important;
                }
                
                .custom-peer-styling tr {
                  border-bottom: 1px solid ${useColorModeValue('rgba(230,235,240,0.2)', 'rgba(60,70,80,0.2)')} !important;
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
            {...featureCardStyles}
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
              transition={{ delay: 0.7, duration: 1 }}
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
                  background: linear-gradient(to right, transparent, ${useColorModeValue('rgba(230,235,240,0.4)', 'rgba(60,70,80,0.4)')}, transparent) !important;
                  margin: 0.5rem 0 !important;
                }
              `}</style>
            </Box>
          </MotionCard>
        )}

        {/* Transfer History */}
        <MotionCard
          {...featureCardStyles}
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
            transition={{ delay: 0.8, duration: 1 }}
          />
          
          <MotionFlex 
            align="center" 
            mb={6}
            initial="hidden"
            animate="visible"
            custom={0.7}
            variants={headingVariants}
          >
            <Icon as={Download} mr={3} color={highlightColor} boxSize={6} />
            <Heading size="md">Transfer History</Heading>
          </MotionFlex>
          
                      <TransferList />
            
            {/* This component might need to be modified in the actual implementation */}
            <Box mt={4} className="custom-transfer-styling">
              {/* Custom styling to override any sharp lines in TransferList component */}
              <style>{`
                .custom-transfer-styling table,
                .custom-transfer-styling tr,
                .custom-transfer-styling td,
                .custom-transfer-styling th {
                  border: none !important;
                  border-collapse: collapse !important;
                }
                
                .custom-transfer-styling tr {
                  border-bottom: 1px solid ${useColorModeValue('rgba(230,235,240,0.2)', 'rgba(60,70,80,0.2)')} !important;
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
                  background: linear-gradient(to right, transparent, ${useColorModeValue('rgba(230,235,240,0.4)', 'rgba(60,70,80,0.4)')}, transparent) !important;
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
