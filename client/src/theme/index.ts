export const colors = {
  primary: {
    DEFAULT: "#ffffff",
    light: "#000000",
  },
  secondary: {
    DEFAULT: "#888888",
    light: "#dddddd",
  },
  accent: {
    DEFAULT: "#666666",
    light: "#f0f0f0",
  },
}

export const animations = {
  pulse: "animate-pulse",
  shine: "animate-shine",
  gradient: "animate-gradient-x",
  glow: "animate-glow",
}

export const glassEffect = {
  light: "bg-white/[0.03] backdrop-blur-xl border border-white/10",
  dark: "bg-black/[0.03] backdrop-blur-xl border border-black/10",
}

export const buttonVariants = {
  primary: {
    light: "bg-black text-white hover:bg-black/90 shadow-lg",
    dark: "bg-white text-black hover:bg-white/90 shadow-lg",
  },
  secondary: {
    light: "bg-neutral-200 text-black hover:bg-neutral-300 shadow-lg",
    dark: "bg-neutral-700 text-white hover:bg-neutral-600 shadow-lg",
  },
  ghostGlass: {
    light: "bg-black/10 text-black backdrop-blur-lg border border-black/20 hover:bg-black/20",
    dark: "bg-white/10 text-white backdrop-blur-lg border border-white/10 hover:bg-white/20",
  },
}
