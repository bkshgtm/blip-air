"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Box,
  Text,
  VStack,
  useColorModeValue,
  Icon,
  List,
  ListItem,
  Button,
  HStack,
  IconButton,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { FileIcon, Upload, X } from "lucide-react"
import { useWebRTCStore } from "../store/webrtcStore"
import { formatFileSize } from "../lib/chunking"

const MotionBox = motion(Box)

const FileDropZone = () => {
  const { selectedFiles, setSelectedFiles } = useWebRTCStore()
  const [isDragging, setIsDragging] = useState(false)

  const bgColor = useColorModeValue("glass.200", "darkGlass.200")
  const borderColor = useColorModeValue("glass.400", "darkGlass.300")
  const activeBorderColor = useColorModeValue("brand.400", "brand.300")
  const glass100 = useColorModeValue("glass.100", "darkGlass.100")

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setSelectedFiles([...selectedFiles, ...acceptedFiles])
      setIsDragging(false)
    },
    [selectedFiles, setSelectedFiles],
  )

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    noClick: selectedFiles.length > 0,
  })

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles]
    newFiles.splice(index, 1)
    setSelectedFiles(newFiles)
  }

  const clearFiles = () => {
    setSelectedFiles([])
  }

  return (
    <VStack spacing={4} width="100%">
      <MotionBox
        {...getRootProps()}
        width="100%"
        height={selectedFiles.length > 0 ? "auto" : "200px"}
        bg={bgColor}
        borderRadius="xl"
        border="2px dashed"
        borderColor={isDragging ? activeBorderColor : borderColor}
        p={4}
        display="flex"
        alignItems="center"
        justifyContent="center"
        cursor={selectedFiles.length > 0 ? "default" : "pointer"}
        transition="all 0.2s"
        animate={{
          borderColor: isDragging ? activeBorderColor : borderColor,
          scale: isDragging ? 1.02 : 1,
        }}
        whileHover={selectedFiles.length === 0 ? { scale: 1.01 } : {}}
      >
        <input {...getInputProps()} />

        {selectedFiles.length === 0 ? (
          <VStack spacing={2}>
            <Icon as={Upload} boxSize={10} color="brand.400" />
            <Text textAlign="center">Drag and drop files here, or click to select files</Text>
          </VStack>
        ) : (
          <VStack width="100%" spacing={4}>
            <HStack width="100%" justifyContent="space-between">
              <Text fontWeight="bold">Selected Files ({selectedFiles.length})</Text>
              <Button size="sm" variant="outline" onClick={clearFiles}>
                Clear All
              </Button>
            </HStack>

            <List spacing={2} width="100%">
              {selectedFiles.map((file, index) => (
                <ListItem
                  key={index}
                  p={2}
                  borderRadius="md"
                  bg={glass100}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <HStack>
                    <Icon as={FileIcon} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                        {file.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatFileSize(file.size)}
                      </Text>
                    </VStack>
                  </HStack>
                  <IconButton
                    aria-label="Remove file"
                    icon={<X size={16} />}
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                  />
                </ListItem>
              ))}
            </List>

            <Button
              leftIcon={<Upload size={16} />}
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                open()
              }}
            >
              Add More Files
            </Button>
          </VStack>
        )}
      </MotionBox>
    </VStack>
  )
}

export default FileDropZone
