import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Verde campo — color primario de acción
        campo: {
          50: "#f2f7ed",
          100: "#e0ecd3",
          200: "#c3daac",
          300: "#9ec27d",
          400: "#7ba955",
          500: "#5c8c3a",
          600: "#476f2d",
          700: "#385625",
          800: "#2f4520",
          900: "#293a1d",
        },
        // Tierra — acentos secundarios / alertas suaves
        tierra: {
          50: "#faf5ee",
          100: "#f0e2ce",
          400: "#c98a4b",
          600: "#9c6431",
          800: "#5e3d1f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
