import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

export default defineConfig(async () => {
  const component = process.env.GAME_COMPONENT;
  const slug = process.env.GAME_SLUG;
  const portal = process.env.PORTAL || "none";
  if (!component || !slug) throw new Error("GAME_COMPONENT and GAME_SLUG are required (use portal/build.mjs)");
  return {
    root: here,
    base: "./",
    plugins: [
      react(),
      {
        name: "game-title",
        transformIndexHtml: (html) => html.replace("%GAME_TITLE%", process.env.GAME_TITLE || slug),
      },
    ],
    resolve: {
      alias: { "virtual-game": path.join(repo, "src/games", `${component}.tsx`) },
    },
    define: {
      __PORTAL__: JSON.stringify(portal),
    },
    css: {
      postcss: {
        plugins: [
          (await import("tailwindcss")).default({
            ...(await import("tailwindcss/loadConfig.js")).default(path.join(repo, "tailwind.config.mjs")),
            // Only the classes this one game can use.
            content: [
              path.join(here, "*.tsx"),
              path.join(repo, "src/components/games/**/*.tsx"),
              path.join(repo, "src/games/lib/**/*.{ts,tsx}"),
              path.join(repo, "src/games", path.dirname(component), "**/*.{ts,tsx}"),
            ],
          }),
          (await import("autoprefixer")).default(),
        ],
      },
    },
    build: {
      outDir: path.join(repo, "portal-dist", portal, slug),
      emptyOutDir: true,
      assetsInlineLimit: 100000,
      chunkSizeWarningLimit: 2000,
    },
    logLevel: "warn",
  };
});
