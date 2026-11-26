import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

// Scripts some portals require as the first, synchronous script in <head>.
const HEAD_SCRIPTS = {
  playgama: '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>',
  yandex: '<script src="/sdk.js"></script>',
};

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

export default defineConfig(async () => {
  const component = process.env.GAME_COMPONENT;
  const slug = process.env.GAME_SLUG;
  const portal = process.env.PORTAL || "none";
  if (!component || !slug) throw new Error("GAME_COMPONENT and GAME_SLUG are required (use portal/build.mjs)");
  const providerFile = path.join(here, "providers", `${portal}.ts`);
  if (!existsSync(providerFile)) throw new Error(`Unknown portal "${portal}": no portal/providers/${portal}.ts`);
  // GameDistribution issues one game id per uploaded game; record them in portal/gd-ids.json ({ "<slug>": "<id>" }).
  const gdFile = path.join(here, "gd-ids.json");
  const gdIds = existsSync(gdFile) ? JSON.parse(readFileSync(gdFile, "utf8")) : {};
  return {
    root: here,
    base: "./",
    plugins: [
      react(),
      {
        name: "game-title",
        transformIndexHtml: (html) =>
          html
            .replace("%GAME_TITLE%", process.env.GAME_TITLE || slug)
            .replace("<head>", `<head>\n    ${HEAD_SCRIPTS[portal] ?? ""}`),
      },
      {
        name: "portal-files",
        generateBundle() {
          if (portal === "playgama") {
            this.emitFile({
              type: "asset",
              fileName: "playgama-bridge-config.json",
              source: readFileSync(path.join(here, "playgama-bridge-config.json"), "utf8"),
            });
          }
        },
      },
    ],
    resolve: {
      alias: {
        "virtual-game": path.join(repo, "src/games", `${component}.tsx`),
        "virtual-provider": providerFile,
      },
    },
    define: {
      __GD_GAME_ID__: JSON.stringify(gdIds[slug] ?? ""),
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
