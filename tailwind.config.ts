import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Studio Precision" palette — deep blue-charcoal canvas with a
        // salmon-pink primary (#F43F5E) and teal secondary (#2DD4BF).
        canvas: "#0b1326", // app background / base surface
        panel: "#141d31", // cards / panels (surface-container)
        panel2: "#222a3d", // raised surfaces (surface-container-high)
        border: "#283349",
        accent: {
          DEFAULT: "#2DD4BF", // secondary — success / progress / system health (teal)
          hover: "#14B8A6",
          soft: "#0c2926",
        },
        salmon: {
          DEFAULT: "#F43F5E", // primary — CTAs / active nav / branding (salmon-pink)
          hover: "#E11D48",
          soft: "#2a0f1a",
        },
        info: "#7aa2f7",
        warn: "#FBBF24",
        danger: "#F2616A",
        ink: {
          DEFAULT: "#dae2fd", // primary text (on-surface, cool near-white)
          muted: "#9aa6c4", // secondary metadata (muted slate)
          faint: "#6b7799",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -14px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(45,212,191,0.4), 0 10px 34px -10px rgba(45,212,191,0.4)",
        "glow-salmon": "0 0 0 1px rgba(244,63,94,0.45), 0 10px 30px -10px rgba(244,63,94,0.4)",
        lift: "0 14px 34px -14px rgba(0,0,0,0.7)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "page-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.99)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        aurora: {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "100%": { transform: "translate3d(-3%, 2%, 0) scale(1.08)" },
        },
        sheen: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(220%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-bar": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "page-in": "page-in 0.42s cubic-bezier(0.22,1,0.36,1) both",
        aurora: "aurora 18s ease-in-out infinite alternate",
        sheen: "sheen 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "pulse-bar": "pulse-bar 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
