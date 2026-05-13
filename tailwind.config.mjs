/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Tools realm ──────────────────────────────────────────
        // All values are CSS-variable-backed so dark mode works via .dark class.
        tool: {
          bg:             "rgb(var(--tool-bg) / <alpha-value>)",
          surface:        "rgb(var(--tool-surface) / <alpha-value>)",
          "surface-2":    "rgb(var(--tool-surface-2) / <alpha-value>)",
          border:         "rgb(var(--tool-border) / <alpha-value>)",
          "border-dim":   "rgb(var(--tool-border-dim) / <alpha-value>)",
          accent:         "rgb(var(--tool-accent) / <alpha-value>)",
          "accent-light": "rgb(var(--tool-accent-light) / <alpha-value>)",
          "accent-dim":   "rgb(var(--tool-accent-dim) / <alpha-value>)",
          muted:          "rgb(var(--tool-muted) / <alpha-value>)",
          text:           "rgb(var(--tool-text) / <alpha-value>)",
          "text-dim":     "rgb(var(--tool-text-dim) / <alpha-value>)",
        },
        // ── Games realm ───────────────────────────────────────────
        game: {
          bg:             "rgb(var(--game-bg) / <alpha-value>)",
          surface:        "rgb(var(--game-surface) / <alpha-value>)",
          "surface-2":    "rgb(var(--game-surface-2) / <alpha-value>)",
          border:         "rgb(var(--game-border) / <alpha-value>)",
          "border-dim":   "rgb(var(--game-border-dim) / <alpha-value>)",
          accent:         "rgb(var(--game-accent) / <alpha-value>)",
          "accent-light": "rgb(var(--game-accent-light) / <alpha-value>)",
          "accent-dim":   "rgb(var(--game-accent-dim) / <alpha-value>)",
          secondary:      "rgb(var(--game-secondary) / <alpha-value>)",
          muted:          "rgb(var(--game-muted) / <alpha-value>)",
          text:           "rgb(var(--game-text) / <alpha-value>)",
          "text-dim":     "rgb(var(--game-text-dim) / <alpha-value>)",
        },
        // ── Landing / shared ──────────────────────────────────────
        brand: {
          tool: "#0891b2",
          game: "#7c3aed",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      typography: {
        tool: {
          css: {
            "--tw-prose-body": "#475569",
            "--tw-prose-headings": "#0f172a",
            "--tw-prose-lead": "#64748b",
            "--tw-prose-links": "#0891b2",
            "--tw-prose-bold": "#0f172a",
            "--tw-prose-counters": "#94a3b8",
            "--tw-prose-bullets": "#cbd5e1",
            "--tw-prose-hr": "#e2e8f0",
            "--tw-prose-quotes": "#475569",
            "--tw-prose-quote-borders": "#e2e8f0",
            "--tw-prose-captions": "#94a3b8",
            "--tw-prose-code": "#0891b2",
            "--tw-prose-pre-code": "#e2e8f0",
            "--tw-prose-pre-bg": "#1e293b",
            "--tw-prose-th-borders": "#e2e8f0",
            "--tw-prose-td-borders": "#f1f5f9",
          },
        },
        game: {
          css: {
            "--tw-prose-body": "#475569",
            "--tw-prose-headings": "#0f172a",
            "--tw-prose-lead": "#64748b",
            "--tw-prose-links": "#7c3aed",
            "--tw-prose-bold": "#0f172a",
            "--tw-prose-counters": "#94a3b8",
            "--tw-prose-bullets": "#ddd6fe",
            "--tw-prose-hr": "#e2e8f0",
            "--tw-prose-quotes": "#475569",
            "--tw-prose-quote-borders": "#e2e8f0",
            "--tw-prose-captions": "#94a3b8",
            "--tw-prose-code": "#7c3aed",
            "--tw-prose-pre-code": "#e2e8f0",
            "--tw-prose-pre-bg": "#1e1b4b",
            "--tw-prose-th-borders": "#e2e8f0",
            "--tw-prose-td-borders": "#f5f3ff",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
