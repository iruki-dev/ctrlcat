import type { PortalProvider } from "./types";
import { setSilenced } from "../audio";
import { withTimeout } from "./loadScript";

// The Bridge script is added to <head> at build time (see vite.config.mjs): it must load first and synchronously.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const bridge: any;

const STORAGE_KEY = "ctrlcat-local";
const PREFIX = "ctrlcat-";

/**
 * Games keep best scores in localStorage under "ctrlcat-*". Playgama asks games to persist through
 * bridge.storage instead, so those keys are mirrored into one bridge.storage entry.
 */
async function mirrorStorage() {
  try {
    const saved = await bridge.storage.get(STORAGE_KEY);
    if (typeof saved === "string" && saved) {
      const data = JSON.parse(saved) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }
  } catch {
    // Nothing saved yet, or storage unavailable.
  }
  const original = Storage.prototype.setItem;
  let timer: number | undefined;
  Storage.prototype.setItem = function (key: string, value: string) {
    original.call(this, key, value);
    if (this !== localStorage || !key.startsWith(PREFIX)) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? "";
      }
      try {
        bridge.storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Best effort.
      }
    }, 300);
  };
}

function send(message: string) {
  try {
    bridge.platform.sendMessage(message);
  } catch {
    // Unsupported on this platform: a no-op by design.
  }
}

export const playgama: PortalProvider = {
  name: "playgama",
  async init() {
    if (typeof bridge === "undefined") return;
    try {
      await withTimeout(bridge.initialize(), 8000, undefined);
      if (bridge.platform.isAudioEnabled === false) setSilenced("platform-audio", true);
      bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: boolean) =>
        setSilenced("platform-audio", !enabled),
      );
      bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused: boolean) =>
        setSilenced("platform-pause", paused),
      );
      await mirrorStorage();
    } catch {
      // Play on without the SDK.
    }
  },
  loadingFinished() {
    if (typeof bridge !== "undefined") send("game_ready");
  },
  host: {
    onEvent(event) {
      if (typeof bridge === "undefined") return;
      if (event.type === "gameplayStart") send("level_started");
      if (event.type === "roundEnd") send(event.outcome === "lost" ? "level_failed" : "level_completed");
    },
    requestBreak() {
      if (typeof bridge === "undefined" || !bridge.advertisement?.isInterstitialSupported) return Promise.resolve();
      const done = new Promise<void>((resolve) => {
        const onState = (state: string) => {
          if (state === "opened") setSilenced("ad", true);
          if (state === "closed" || state === "failed") {
            setSilenced("ad", false);
            bridge.advertisement.off?.(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
            resolve();
          }
        };
        bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
        try {
          bridge.advertisement.showInterstitial("round_end");
        } catch {
          resolve();
        }
        // Bridge skips the ad when the minimum delay has not passed; it may then emit nothing at all.
        window.setTimeout(() => {
          if (bridge.advertisement.interstitialState !== "opened") resolve();
        }, 1500);
      });
      return withTimeout(done, 60000, undefined).finally(() => setSilenced("ad", false));
    },
  },
};
export default playgama;
