import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://ctrlcat.dev",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap({ i18n: { defaultLocale: "en", locales: { en: "en", ko: "ko" } } }),
  ],
  output: "static",
  // The block game was published under an earlier name; keep its old links working.
  redirects: {
    "/games/tetris": "/games/block-drop",
    "/ko/games/tetris": "/ko/games/block-drop",
  },
});
