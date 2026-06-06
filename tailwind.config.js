/** @type {import('tailwindcss').Config} */
// Linear + Vercel hybrid design tokens. Indigo accent (NOT lavender) for
// brand differentiation. Surface ladder + hairlines carry hierarchy; no
// drop shadows on cards — only on floating overlays (dropdown/modal).
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/daisyui/dist/**/*.js",
    "node_modules/react-daisyui/dist/**/*.js",
  ],
  // Disable Tailwind's built-in responsive `.container` (it clamps to fixed
  // max-widths per breakpoint, leaving a large empty gutter on wide screens).
  // Our own full-width `.container` lives in styles.css @layer utilities.
  corePlugins: {
    container: false,
  },
  theme: {
    extend: {
      colors: {
        canvas: "var(--gw-canvas)",
        "surface-1": "var(--gw-surface-1)",
        "surface-2": "var(--gw-surface-2)",
        "surface-3": "var(--gw-surface-3)",
        "surface-4": "var(--gw-surface-4)",
        hairline: "var(--gw-hairline)",
        "hairline-strong": "var(--gw-hairline-strong)",
        "fg-primary": "var(--gw-fg-primary)",
        "fg-secondary": "var(--gw-fg-secondary)",
        "fg-muted": "var(--gw-fg-muted)",
        brand: "var(--gw-brand)",
        "brand-soft": "var(--gw-brand-soft)",
        "gw-success": "var(--gw-success)",
        "gw-warning": "var(--gw-warning)",
        "gw-error": "var(--gw-error)",
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["32px", { lineHeight: "1.1", letterSpacing: "-0.04em" }],
        h1: ["24px", { lineHeight: "1.2", letterSpacing: "-0.03em" }],
        h2: ["20px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        h3: ["16px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        body: ["14px", { lineHeight: "1.5", letterSpacing: "0" }],
        "body-sm": ["13px", { lineHeight: "1.45" }],
        caption: ["12px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        "gw-xs": "4px",
        "gw-sm": "6px",
        "gw-md": "8px",
        "gw-lg": "12px",
        "gw-xl": "16px",
        "gw-2xl": "24px",
      },
      boxShadow: {
        "gw-floating":
          "0 4px 12px rgba(0,0,0,0.3), inset 0 0 0 1px var(--gw-hairline-strong)",
        "gw-card": "inset 0 0 0 1px var(--gw-hairline)",
        "gw-card-hover": "inset 0 0 0 1px var(--gw-hairline-strong)",
      },
      transitionTimingFunction: {
        "gw-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        100: "100ms",
        150: "150ms",
        200: "200ms",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        "garage-dark": {
          primary: "#6366f1",
          "primary-content": "#ffffff",
          secondary: "#818cf8",
          "secondary-content": "#0a0a0b",
          accent: "#6366f1",
          "accent-content": "#ffffff",
          neutral: "#22222a",
          "neutral-content": "#f4f4f5",
          "base-100": "#131316",
          "base-200": "#0a0a0b",
          "base-300": "#1a1a1e",
          "base-content": "#f4f4f5",
          info: "#3b82f6",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          "--rounded-box": "0.5rem",
          "--rounded-btn": "0.375rem",
          "--rounded-badge": "0.375rem",
          "--btn-text-case": "none",
          "--border-btn": "1px",
          "--tab-radius": "0.375rem",
        },
      },
      {
        "garage-light": {
          primary: "#4f46e5",
          "primary-content": "#ffffff",
          secondary: "#6366f1",
          "secondary-content": "#ffffff",
          accent: "#4f46e5",
          "accent-content": "#ffffff",
          neutral: "#e4e4e7",
          "neutral-content": "#18181b",
          "base-100": "#ffffff",
          "base-200": "#fafafa",
          "base-300": "#f4f4f5",
          "base-content": "#18181b",
          info: "#0ea5e9",
          success: "#059669",
          warning: "#d97706",
          error: "#dc2626",
          "--rounded-box": "0.5rem",
          "--rounded-btn": "0.375rem",
          "--rounded-badge": "0.375rem",
          "--btn-text-case": "none",
          "--border-btn": "1px",
          "--tab-radius": "0.375rem",
        },
      },
    ],
    darkTheme: "garage-dark",
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};
