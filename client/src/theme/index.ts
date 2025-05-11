// theme/index.ts
import { extendTheme } from "@chakra-ui/react"
import { mode } from "@chakra-ui/theme-tools"
import type { StyleFunctionProps } from "@chakra-ui/styled-system"

const config = {
  initialColorMode: "dark",
  useSystemColorMode: false,
}

const colors = {
  brand: {
    50: "#F7F7F7",
    100: "#E1E1E1",
    200: "#CFCFCF",
    300: "#B1B1B1",
    400: "#9E9E9E",
    500: "#7E7E7E",
    600: "#626262",
    700: "#515151",
    800: "#3B3B3B",
    900: "#1F1F1F",
  },
  glass: {
    100: "rgba(255,255,255,0.04)",
    200: "rgba(255,255,255,0.08)",
    300: "rgba(255,255,255,0.12)",
    400: "rgba(255,255,255,0.16)",
    500: "rgba(255,255,255,0.20)",
  },
  matte: {
    100: "#080808",
    200: "#101010",
    300: "#181818",
    400: "#202020",
    500: "#282828",
  },
  noise: {
    light: "url('/noise-light.png')",
    dark: "url('/noise-dark.png')",
  },
}

const styles = {
  global: (props: StyleFunctionProps) => {
    const dark = mode(false, true)(props)
    return {
      // keyframes for shine sweep
      "@keyframes shine": {
        "0%":   { transform: "translate(-200%, -50%) rotate(25deg)" },
        "100%": { transform: "translate(200%, -50%) rotate(25deg)" },
      },
      // keyframes for animated background gradient
      "@keyframes bgGradient": {
        "0%, 100%": { backgroundPosition: "0% 50%" },
        "50%":      { backgroundPosition: "100% 50%" },
      },
      body: {
        position: "relative",
        bg: dark ? colors.matte[200] : "white",
        color: mode("gray.800", "gray.100")(props),
        minHeight: "100vh",
        backgroundImage: dark
          ? `${colors.noise.dark}, linear-gradient(270deg, #171717, #1F1F1F, #080808)`
          : `${colors.noise.light}, linear-gradient(270deg, #FFFFFF, #F5F5F5, #EAEAEA)`,
        backgroundBlendMode: "overlay, normal",
        backgroundSize: "300% 300%, cover",
        animation: "bgGradient 20s ease infinite",
        backgroundAttachment: "fixed",
        _before: {
          content: '""',
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.04) 0,
              rgba(255,255,255,0.04) 1px,
              transparent 1px,
              transparent 24px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.04) 0,
              rgba(255,255,255,0.04) 1px,
              transparent 1px,
              transparent 24px
            )
          `,
          backgroundSize: "24px 24px",
          opacity: dark ? 0.2 : 0.1,
        },
      },
      "::selection": {
        backgroundColor: mode("brand.200", "brand.700")(props),
        color: "black",
      },
    }
  },
}

const components = {
  Button: {
    baseStyle: {
      fontWeight: "semibold",
      borderRadius: "2xl",
      textTransform: "uppercase",
      letterSpacing: "wider",
    },
    variants: {
      ghostGlass: (props: StyleFunctionProps) => ({
        bg: mode("glass.200", "glass.300")(props),
        color: mode("brand.800", "whiteAlpha.900")(props),
        backdropFilter: "blur(12px)",
        _hover: {
          bg: mode("glass.300", "glass.400")(props),
          transform: "scale(1.02)",
        },
        _active: {
          bg: mode("glass.400", "glass.500")(props),
        },
      }),
      solid: (props: StyleFunctionProps) => ({
        bg: mode("brand.600", "brand.400")(props),
        color: "white",
        _hover: {
          bg: mode("brand.700", "brand.500")(props),
        },
      }),
    },
  },
}

const layerStyles = {
  glass: (props: StyleFunctionProps) => ({
    bg: mode("glass.100", "glass.200")(props),
    backdropFilter: "saturate(180%) blur(12px)",
    border: "1px solid",
    borderColor: mode("glass.200", "glass.300")(props),
    borderRadius: "2xl",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    position: "relative",
    overflow: "hidden",
    _hover: {
      boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
    },
    _before: {
      content: '""',
      position: "absolute",
      top: "-50%",
      left: "-50%",
      width: "200%",
      height: "200%",
      bgGradient:
        "linear(to-r, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)",
      transform: "rotate(25deg)",
      filter: "blur(30px)",
      animation: "shine 3s infinite",
      pointerEvents: "none",
    },
  }),
}

export default extendTheme({
  config,
  colors,
  styles,
  components,
  layerStyles,
  fonts: {
    heading: `'Satoshi', -apple-system, sans-serif`,
    body: `'Inter', -apple-system, sans-serif`,
  },
  shadows: {
    outline: "0 0 0 3px rgba(255,255,255,0.24)",
    md:      "0 8px 16px rgba(0,0,0,0.4)",
  },
})
