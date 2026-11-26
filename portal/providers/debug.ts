import type { PortalProvider } from "./types";

/**
 * Local testing build with no SDK. Logs every game event to the console and
 * fakes a short break between rounds, so the hooks can be checked by hand or by a test script.
 * Build with: node portal/build.mjs --portal debug <slug>
 */
export const debug: PortalProvider = {
  name: "debug",
  async init() {
    console.log("[portal] init");
  },
  loadingFinished() {
    console.log("[portal] loadingFinished");
  },
  host: {
    onEvent(event) {
      console.log("[portal]", JSON.stringify(event));
    },
    requestBreak() {
      console.log("[portal] break");
      return new Promise((resolve) => setTimeout(resolve, 300));
    },
  },
};
