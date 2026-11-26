import type { PortalProvider } from "./types";
import { none } from "./none";
import { debug } from "./debug";

const providers: Record<string, () => Promise<PortalProvider>> = {
  none: async () => none,
  debug: async () => debug,
};

export async function getProvider(name: string): Promise<PortalProvider> {
  const load = providers[name];
  if (!load) throw new Error(`Unknown portal "${name}". Known: ${Object.keys(providers).join(", ")}`);
  return load();
}
