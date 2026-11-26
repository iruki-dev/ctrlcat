import type { PortalProvider } from "./types";
import { setSilenced } from "../audio";
import { loadScript, withTimeout } from "./loadScript";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const __GD_GAME_ID__: string;

let resumeWaiters: Array<() => void> = [];
let ready = false;
let adPaused = false;

function resumeAll() {
  adPaused = false;
  setSilenced("ad", false);
  const waiters = resumeWaiters;
  resumeWaiters = [];
  waiters.forEach((w) => w());
}

export const gamedistribution: PortalProvider = {
  name: "gamedistribution",
  async init() {
    if (!__GD_GAME_ID__) {
      console.warn("[portal] GameDistribution game id missing: set it in portal/gd-ids.json");
      return;
    }
    (window as any).GD_OPTIONS = {
      gameId: __GD_GAME_ID__,
      onEvent(event: { name: string }) {
        switch (event.name) {
          case "SDK_READY":
            ready = true;
            break;
          case "SDK_GAME_PAUSE":
            adPaused = true;
            setSilenced("ad", true);
            break;
          case "SDK_GAME_START":
          case "AD_ERROR":
            resumeAll();
            break;
        }
      },
    };
    try {
      await withTimeout(loadScript("https://html5.api.gamedistribution.com/main.min.js", { id: "gamedistribution-jssdk" }), 8000, undefined);
    } catch {
      // Play on without ads.
    }
  },
  host: {
    requestBreak() {
      const sdk = (window as any).gdsdk;
      if (!ready || !sdk?.showAd) return Promise.resolve();
      const done = new Promise<void>((resolve) => {
        resumeWaiters.push(resolve);
        Promise.resolve(sdk.showAd()).catch(() => resumeAll());
        // When the SDK throttles the call it may never pause the game; continue if no ad started.
        window.setTimeout(() => {
          if (resumeWaiters.includes(resolve) && !adPaused) {
            resumeWaiters = resumeWaiters.filter((w) => w !== resolve);
            resolve();
          }
        }, 2500);
      });
      return withTimeout(done, 60000, undefined).finally(() => setSilenced("ad", false));
    },
  },
};
export default gamedistribution;
