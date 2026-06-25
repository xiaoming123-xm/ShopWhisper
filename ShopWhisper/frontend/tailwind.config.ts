import type { Config } from "tailwindcss";
import {
  brandColors,
  functionalColors,
  neutralColors,
  spacing,
  borderRadius,
  shadows,
  fontFamily,
  fontSize,
  fontWeight,
  animation,
  zIndex,
  breakpoints,
} from "./src/styles/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌色
        brand: brandColors,
        // 功能色
        success: functionalColors.success,
        warning: functionalColors.warning,
        error: functionalColors.error,
        info: functionalColors.info,
        // 中性色
        neutral: neutralColors,
        // 语义色别名
        primary: {
          DEFAULT: brandColors[500],
          light: brandColors[400],
          dark: brandColors[600],
          50: brandColors[50],
          100: brandColors[100],
          200: brandColors[200],
          300: brandColors[300],
          400: brandColors[400],
          500: brandColors[500],
          600: brandColors[600],
          700: brandColors[700],
          800: brandColors[800],
          900: brandColors[900],
          950: brandColors[950],
        },
        // CSS 变量语义色
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card-bg)",
        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-hover": "var(--sidebar-hover)",
        "sidebar-active": "var(--sidebar-active)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      textColor: {
        heading: "var(--text-primary)",
        body: "var(--text-secondary)",
        muted: "var(--text-tertiary)",
      },
      spacing,
      borderRadius,
      boxShadow: shadows,
      fontFamily,
      fontSize,
      fontWeight,
      transitionDuration: animation.duration,
      transitionTimingFunction: animation.easing,
      zIndex,
      screens: breakpoints,
    },
  },
  plugins: [],
};
export default config;
