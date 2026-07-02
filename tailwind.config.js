// SPDX-License-Identifier: AGPL-3.0-or-later

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Kufi Arabic"', '"Inter"', "system-ui", "sans-serif"],
        latin: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Map design tokens to Tailwind utilities via CSS variables.
        bg:        "var(--bg)",
        surface:   "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "app-border":   "var(--border)",
        "app-border-2": "var(--border-2)",
        "app-text":  "var(--text)",
        "app-text-2":"var(--text-2)",
        "app-muted": "var(--muted)",
        accent:    "var(--accent)",
        "accent-2":"var(--accent-2)",
      },
    },
  },
  plugins: [],
};
