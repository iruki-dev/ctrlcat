/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Tools realm (light, cyan accent) ─────────────────────
        tool: {
          bg: "#f8fafc",         // slate-50  – page background
          surface: "#ffffff",     // white     – cards, panels
          "surface-2": "#f1f5f9", // slate-100 – sidebar, hover bg
          border: "#e2e8f0",      // slate-200 – default border
          "border-dim": "#f1f5f9",// slate-100 – subtle separator
          accent: "#0891b2",      // cyan-600  – primary action
          "accent-light": "#e0f7fa",// cyan-50 – accent tint bg
          "accent-dim": "#0e7490",// cyan-700  – hover
          muted: "#94a3b8",       // slate-400 – placeholder, meta
          text: "#0f172a",        // slate-900 – primary text
          "text-dim": "#475569",  // slate-600 – secondary text
        },
        // ── Games realm (light, violet accent) ───────────────────
        game: {
          bg: "#f8fafc",
          surface: "#ffffff",
          "surface-2": "#f5f3ff", // violet-50
          border: "#e2e8f0",
          "border-dim": "#f1f5f9",
          accent: "#7c3aed",      // violet-600
          "accent-light": "#ede9fe",// violet-100
          "accent-dim": "#6d28d9",// violet-700
          secondary: "#db2777",   // pink-600
          muted: "#94a3b8",
          text: "#0f172a",
          "text-dim": "#475569",
        },
        // ── Shared landing ────────────────────────────────────────
        brand: {
          tool: "#0891b2",   // cyan-600
          game: "#7c3aed",   // violet-600
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
