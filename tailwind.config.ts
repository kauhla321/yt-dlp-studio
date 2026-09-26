import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "mono night" palette — pure black canvas, IBM Plex Mono everywhere,
        // an inverted ink fill for every selected/active state. Inspired by
        // cobalt.tools; no color hierarchy beyond the status accents below.
        bg: "#000000",
        rail: "#111111",
        surface: "#111111",
        "surface-2": "#161616",
        raised: "#1f1f1f",
        "input-border": "#3a3a3a",
        "input-border-focus": "#5a5a5a",
        ink: {
          DEFAULT: "#e1e1e1",
          muted: "#a0a0a0",
          faint: "#8a8a8a",
          dim: "#5a5a5a",
        },
        video: { DEFAULT: "#ffcf56", tint: "#3a2e0a" },
        audio: { DEFAULT: "#b18cff", tint: "#2a1f45" },
        subs: { DEFAULT: "#6cb6ff", tint: "#0f2940" },
        done: "#5fd38d",
        danger: { DEFAULT: "#ff6b6b", text: "#ff9b9b", bg: "#1f0e0e" },
        warn: { DEFAULT: "#ffcf56", bg: "#1a1506", border: "#3d3110" },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        control: "11px",
        card: "18px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        sheen: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out both",
        sheen: "sheen 2s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
