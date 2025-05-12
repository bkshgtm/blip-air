"use client"

import { useNavigate, useLocation } from "react-router-dom"
import {
  Flex,
  Box,
  HStack,
  IconButton,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  // useDisclosure, // Removed
  useColorModeValue,
} from "@chakra-ui/react"
import { motion } from "framer-motion"
import { Home, FileUp, Settings, Menu as MenuIcon, QrCode } from "lucide-react"
import { useSettingsStore } from "../store/settingsStore"
import { useUiStore } from "../store/uiStore" // Added
// import QRCodeModal from "./QRCodeModal" // Removed

const MotionFlex = motion(Flex)
const MotionIconButton = motion(IconButton)
const MotionBox = motion(Box)

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionName } = useSettingsStore()
  const { openQrCodeModal } = useUiStore() // Use uiStore

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { name: "Home", path: "/", icon: <Home size={20} /> },
    { name: "Transfer", path: "/transfer", icon: <FileUp size={20} /> },
    { name: "Settings", path: "/settings", icon: <Settings size={20} /> },
  ]

  return (
    <>
      <MotionFlex
        as="nav"
        layerStyle="glass"
        px={{ base: 4, md: 8 }}
        py={3}
        wrap="wrap"
        align="center"
        justify="space-between"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }} // Faster: 0.5 -> 0.3
      >
        {/* Logo & Session */}
        <HStack spacing={2} align="center">
          <MotionBox whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Text
              fontSize="2xl"
              fontWeight="extrabold"
              bgGradient="linear(to-r, brand.500, brand.400)"
              bgClip="text"
            >
              P2P Share
            </Text>
          </MotionBox>
          <Text fontSize="sm" opacity={0.7}>
            {sessionName}
          </Text>
        </HStack>

        {/* Desktop Nav */}
        <HStack spacing={4} display={{ base: "none", md: "flex" }}>
          {navItems.map((item) => (
            <MotionIconButton
              key={item.name}
              variant="ghostGlass"
              aria-label={item.name}
              icon={item.icon}
              onClick={() => navigate(item.path)}
              size="lg"
              borderRadius="xl"
              position="relative"
              color={isActive(item.path) ? "brand.400" : undefined}
              _after={
                isActive(item.path)
                  ? {
                      content: '""',
                      position: "absolute",
                      bottom: 0,
                      left: "25%",
                      width: "50%",
                      height: "2px",
                      bg: "brand.400",
                      borderRadius: "full",
                    }
                  : undefined
              }
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            />
          ))}

          <MotionIconButton
            variant="solid"
            colorScheme="brand"
            aria-label="Show QR Code"
            icon={<QrCode />}
            onClick={openQrCodeModal} // Use openQrCodeModal from uiStore
            borderRadius="xl"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
        </HStack>

        {/* Mobile Nav */}
        <Box display={{ base: "block", md: "none" }}>
          <Menu>
            <MenuButton
              as={IconButton}
              variant="ghostGlass"
              aria-label="Open menu"
              icon={<MenuIcon />}
            />
            <MenuList border="none" boxShadow="lg"> 
              {/* layerStyle="glass" removed, will be themed by components.Menu.baseStyle.list */}
              {navItems.map((item) => (
                <MenuItem
                  key={item.name}
                  icon={item.icon}
                  onClick={() => navigate(item.path)}
                  fontWeight={isActive(item.path) ? "bold" : "normal"}
                  color={isActive(item.path) ? "brand.400" : undefined}
                  // Resetting hover/focus to let MenuList/MenuItem theme defaults apply or be controlled by layerStyle
                  _hover={{}} 
                  _focus={{}}
                >
                  {item.name}
                </MenuItem>
              ))}
              <MenuItem 
                icon={<QrCode />} 
                onClick={openQrCodeModal}
                _hover={{}}
                _focus={{}}
              > 
                Show QR Code
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </MotionFlex>

      {/* QRCodeModal is now rendered in Layout.tsx */}
    </>
  )
}

export default Navbar
