"use client"

import {
  Box,
  Text,
  VStack,
  HStack,
  CircularProgress,
  CircularProgressLabel,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize, formatSpeed } from "../lib/chunking"

const MotionBox = motion(Box)

const TransferStats = () => {
  const { transfers } = useWebRTCStore()

  const bgColor = useColorModeValue("glass.200", "darkGlass.200")
  const borderColor = useColorModeValue("glass.300", "darkGlass.100")

  // Calculate total stats
  const activeTransfers = transfers.filter((t) => t.status === "transferring" || t.status === "paused")

  const completedTransfers = transfers.filter((t) => t.status === "completed")

  const totalSize = transfers.reduce((acc, t) => acc + t.fileSize, 0)

  const totalTransferred = transfers.reduce((acc, t) => acc + t.fileSize * t.progress, 0)

  const averageSpeed =
    activeTransfers.length > 0 ? activeTransfers.reduce((acc, t) => acc + t.speed, 0) / activeTransfers.length : 0

  const overallProgress = totalSize > 0 ? totalTransferred / totalSize : 0

  return (
    <MotionBox
      p={4}
      borderRadius="xl"
      border="none"
      position="relative"
      overflow="hidden"
      bg="transparent"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SimpleGrid 
        columns={{ base: 1, md: 4 }} 
        spacing={4}
        bg="transparent"
      >
        <HStack spacing={4}>
          <CircularProgress value={overallProgress * 100} color="brand.400" size="80px" thickness="8px">
            <CircularProgressLabel>{Math.round(overallProgress * 100)}%</CircularProgressLabel>
          </CircularProgress>
          <VStack align="start" spacing={0}>
            <Text fontSize="sm" color="gray.500">
              Overall Progress
            </Text>
            <Text>
              {formatFileSize(totalTransferred)} / {formatFileSize(totalSize)}
            </Text>
          </VStack>
        </HStack>

        <Stat>
          <StatLabel>Active Transfers</StatLabel>
          <StatNumber>{activeTransfers.length}</StatNumber>
          <StatHelpText>
            {activeTransfers.length > 0 ? `${activeTransfers.length} in progress` : "No active transfers"}
          </StatHelpText>
        </Stat>

        <Stat>
          <StatLabel>Completed</StatLabel>
          <StatNumber>{completedTransfers.length}</StatNumber>
          <StatHelpText>
            {completedTransfers.length > 0
              ? `${formatFileSize(completedTransfers.reduce((acc, t) => acc + t.fileSize, 0))} transferred`
              : "No completed transfers"}
          </StatHelpText>
        </Stat>

        <Stat>
          <StatLabel>Current Speed</StatLabel>
          <StatNumber>{formatSpeed(averageSpeed)}</StatNumber>
          <StatHelpText>
            {activeTransfers.length > 0 ? `Across ${activeTransfers.length} transfers` : "No active transfers"}
          </StatHelpText>
        </Stat>
      </SimpleGrid>
    </MotionBox>
  )
}

export default TransferStats
