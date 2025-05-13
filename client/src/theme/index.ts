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
      "@keyframes pulse": {
        "0%, 100%": { transform: "scale(1)" },
        "50%": { transform: "scale(1.05)" },
      },
      "@keyframes shine": {
        "0%": { transform: "translate(-100%, -50%) rotate(25deg)" },
        "100%": { transform: "translate(100%, -50%) rotate(25deg)" },
      },

      "@keyframes bgGradient": {
        "0%, 100%": { backgroundPosition: "0% 50%" },
        "50%": { backgroundPosition: "100% 50%" },
      },
      html: {
        bg: dark ? colors.matte[200] : "white",
        minHeight: "100%",
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
      },
      "::selection": {
        backgroundColor: mode("brand.200", "brand.700")(props),
        color: "black",
      },
    }
  },
}

const components = {
  Menu: {
    baseStyle: (props: StyleFunctionProps) => ({
      list: {
        bg: mode("rgba(255, 255, 255, 0.75)", "rgba(24, 24, 24, 0.75)")(props),
        backdropFilter: "saturate(180%) blur(12px)",
        border: "1px solid",
        borderColor: mode("rgba(255,255,255,0.12)", "rgba(255,255,255,0.12)")(props),
        borderRadius: "xl",
        boxShadow: "lg",
      },
      item: {
        bg: "transparent",
        _hover: {
          bg: mode("whiteAlpha.200", "whiteAlpha.100")(props),
        },
        _focus: {
          bg: mode("whiteAlpha.200", "whiteAlpha.100")(props),
        },
      },
    }),
  },
  Button: {
    baseStyle: {
      fontWeight: "semibold",
      borderRadius: "2xl",
      textTransform: "uppercase",
      letterSpacing: "wider",
    },
    variants: {
      ghostGlass: (props: StyleFunctionProps) => ({
        bg: mode("rgba(255,255,255,0.2)", "rgba(0,0,0,0.2)")(props),
        color: mode("brand.800", "whiteAlpha.900")(props),
        backdropFilter: "blur(12px)",
        pointerEvents: "auto",
        border: "1px solid",
        borderColor: mode("rgba(0,0,0,0.1)", "rgba(255,255,255,0.1)")(props),
        position: "relative",
        overflow: "hidden",
        _hover: {
          bg: mode("rgba(255,255,255,0.3)", "rgba(0,0,0,0.3)")(props),
        },
        _active: {
          bg: mode("rgba(255,255,255,0.4)", "rgba(0,0,0,0.4)")(props),
        },
      }),
      startSharing: (props: StyleFunctionProps) => ({
        bg: mode("rgba(255,255,255,0.2)", "rgba(0,0,0,0.2)")(props),
        color: mode("brand.800", "whiteAlpha.900")(props),
        backdropFilter: "blur(12px)",
        pointerEvents: "auto",
        border: "1px solid",
        borderColor: mode("rgba(0,0,0,0.1)", "rgba(255,255,255,0.1)")(props),
        position: "relative",
        overflow: "hidden",
        _hover: {
          bg: mode("rgba(255,255,255,0.3)", "rgba(0,0,0,0.3)")(props),
        },
        animation: "pulse 1.5s ease-in-out infinite",
        _active: {
          bg: mode("rgba(255,255,255,0.4)", "rgba(0,0,0,0.4)")(props),
        },
        _before: {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: mode(
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0) 100%)",
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)",
          )(props),
          animation: "shine 2s linear infinite",
          pointerEvents: "none",
        },
      }),
      qrGlass: (props: StyleFunctionProps) => ({
        bg: mode("rgba(100,100,120,0.1)", "rgba(100,100,120,0.1)")(props),
        color: mode("gray.800", "whiteAlpha.900")(props),
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        border: "1px solid",
        borderColor: mode("rgba(100,100,120,0.15)", "rgba(100,100,120,0.15)")(props),
        _hover: {
          bg: mode("rgba(100,100,120,0.15)", "rgba(100,100,120,0.15)")(props),
        },
        _active: {
          bg: mode("rgba(100,100,120,0.2)", "rgba(100,100,120,0.2)")(props),
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
    bg: mode("rgba(255, 255, 255, 0.65)", "rgba(24, 24, 24, 0.65)")(props),
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
      bgGradient: "linear(to-r, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)",
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
    md: "0 8px 16px rgba(0,0,0,0.4)",
  },
})
