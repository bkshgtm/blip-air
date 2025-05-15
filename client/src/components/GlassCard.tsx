"use client"

import type React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { useTheme } from "./theme-provider"

export interface GlassCardProps extends HTMLMotionProps<"div"> {
  hoverEffect?: boolean
  glowIntensity?: "none" | "low" | "medium" | "high"
  textureOpacity?: number
  children?: React.ReactNode
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  hoverEffect = true,
  glowIntensity = "low",
  textureOpacity = 0.03,
  ...rest
}) => {
  const { theme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const getGlowShadow = () => {
    if (isDark) {
      switch (glowIntensity) {
        case "none":
          return ""
        case "low":
          return "0 4px 20px rgba(0, 0, 0, 0.2)"
        case "medium":
          return "0 8px 30px rgba(0, 0, 0, 0.25)"
        case "high":
          return "0 12px 40px rgba(0, 0, 0, 0.3)"
        default:
          return "0 4px 20px rgba(0, 0, 0, 0.2)"
      }
    } else {
      switch (glowIntensity) {
        case "none":
          return ""
        case "low":
          return "0 4px 20px rgba(0, 0, 0, 0.1)"
        case "medium":
          return "0 8px 30px rgba(0, 0, 0, 0.15)"
        case "high":
          return "0 12px 40px rgba(0, 0, 0, 0.2)"
        default:
          return "0 4px 20px rgba(0, 0, 0, 0.1)"
      }
    }
  }

  const getHoverGlowShadow = () => {
    if (isDark) {
      switch (glowIntensity) {
        case "none":
          return ""
        case "low":
          return "0 8px 30px rgba(0, 0, 0, 0.25)"
        case "medium":
          return "0 12px 40px rgba(0, 0, 0, 0.3)"
        case "high":
          return "0 16px 50px rgba(0, 0, 0, 0.35)"
        default:
          return "0 8px 30px rgba(0, 0, 0, 0.25)"
      }
    } else {
      switch (glowIntensity) {
        case "none":
          return ""
        case "low":
          return "0 8px 30px rgba(0, 0, 0, 0.15)"
        case "medium":
          return "0 12px 40px rgba(0, 0, 0, 0.2)"
        case "high":
          return "0 16px 50px rgba(0, 0, 0, 0.25)"
        default:
          return "0 8px 30px rgba(0, 0, 0, 0.15)"
      }
    }
  }

  return (
    <motion.div
      className={`
        relative overflow-hidden
        ${
          isDark
            ? "bg-glass backdrop-blur-xl border border-white/5"
            : "bg-glass-light backdrop-blur-xl border border-black/5"
        }
        rounded-2xl
        transition-all duration-300
        ${className}
      `}
      style={{
        boxShadow: getGlowShadow(),
      }}
      whileHover={
        hoverEffect
          ? {
              scale: 1.01,
              boxShadow: getHoverGlowShadow(),
            }
          : {}
      }
      {...rest}
    >
      {/* Texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http:
            isDark ? "ffffff" : "000000"
          }' fillOpacity='${textureOpacity}'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

export default GlassCard
