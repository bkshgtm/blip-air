"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTheme } from "../theme-provider"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-white/10 text-white/90 hover:bg-white/15 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15 backdrop-blur-sm",
        destructive:
          "bg-white/5 text-white/80 hover:bg-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10",
        outline:
          "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white/90 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white/90 backdrop-blur-sm",
        secondary:
          "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white/90 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white/90",
        ghost:
          "text-white/70 hover:bg-white/5 hover:text-white/90 dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white/90",
        link: "text-white/70 underline-offset-4 hover:underline hover:text-white/90 dark:text-white/70 dark:hover:underline dark:hover:text-white/90",
        primary:
          "bg-white/10 text-white/90 hover:bg-white/15 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15 backdrop-blur-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const { theme } = useTheme()
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

    // Adjust classes based on theme
    let themeAdjustedClass = className || ""

    if (!isDark) {
      // For light theme, replace white with black in the classes
      if (variant === "default" || variant === "primary") {
        themeAdjustedClass = "bg-black/10 text-black/90 hover:bg-black/15 backdrop-blur-sm " + (className || "")
      } else if (variant === "destructive") {
        themeAdjustedClass = "bg-black/5 text-black/80 hover:bg-black/10 " + (className || "")
      } else if (variant === "outline") {
        themeAdjustedClass =
          "border border-black/10 bg-black/5 text-black/80 hover:bg-black/10 hover:text-black/90 backdrop-blur-sm " +
          (className || "")
      } else if (variant === "secondary") {
        themeAdjustedClass = "bg-black/5 text-black/80 hover:bg-black/10 hover:text-black/90 " + (className || "")
      } else if (variant === "ghost") {
        themeAdjustedClass = "text-black/70 hover:bg-black/5 hover:text-black/90 " + (className || "")
      } else if (variant === "link") {
        themeAdjustedClass = "text-black/70 underline-offset-4 hover:underline hover:text-black/90 " + (className || "")
      }
    }

    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size }), themeAdjustedClass)} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
