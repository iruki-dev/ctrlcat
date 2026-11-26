import type { PortalProvider } from "./types";

/** Plain build with no SDK (itch.io, self-hosting, local testing). */
export const none: PortalProvider = {
  name: "none",
  async init() {},
  host: {},
};
export default none;
