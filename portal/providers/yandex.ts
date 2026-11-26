import type { PortalProvider } from "./types";
import { setSilenced } from "../audio";
import { withTimeout } from "./loadScript";

// "/sdk.js" is added to <head> at build time (see vite.config.mjs), as Yandex moderation requires.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const YaGames: any;
let ysdk: any = null;

export const yandex: PortalProvider = {
  name: "yandex",
  async init() {
    if (typeof YaGames === "undefined") return;
    try {
      ysdk = await withTimeout(YaGames.init(), 8000, null);
      ysdk?.on?.("game_api_pause", () => setSilenced("platform-pause", true));
      ysdk?.on?.("game_api_resume", () => setSilenced("platform-pause", false));
      const lang: string | undefined = ysdk?.environment?.i18n?.lang;
      if (lang) document.documentElement.dataset.portalLang = lang;
    } catch {
      ysdk = null;
    }
  },
  loadingFinished() {
    ysdk?.features?.LoadingAPI?.ready?.();
  },
  host: {
    onEvent(event) {
      if (!ysdk) return;
      if (event.type === "gameplayStart") ysdk.features?.GameplayAPI?.start?.();
      if (event.type === "gameplayStop") ysdk.features?.GameplayAPI?.stop?.();
    },
    requestBreak() {
      if (!ysdk?.adv) return Promise.resolve();
      const done = new Promise<void>((resolve) => {
        try {
          ysdk.adv.showFullscreenAdv({
            callbacks: {
              onOpen: () => setSilenced("ad", true),
              onClose: () => resolve(),
              onError: () => resolve(),
            },
          });
        } catch {
          resolve();
        }
      });
      return withTimeout(done, 60000, undefined).finally(() => setSilenced("ad", false));
    },
  },
};
export default yandex;
