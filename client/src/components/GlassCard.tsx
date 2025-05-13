import React from "react"
import { Box, BoxProps } from "@chakra-ui/react"

export interface GlassCardProps extends BoxProps {}

const GlassCard: React.FC<GlassCardProps> = ({ children, ...rest }) => (
  <Box layerStyle="glass" {...rest}>
    {children}
  </Box>
)

export default GlassCard
