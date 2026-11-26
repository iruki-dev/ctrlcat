import type { PortalProvider } from "./types";
import { none } from "./none";

const providers: Record<string, () => Promise<PortalProvider>> = {
  none: async () => none,
};

export async function getProvider(name: string): Promise<PortalProvider> {
  const load = providers[name];
  if (!load) throw new Error(`Unknown portal "${name}". Known: ${Object.keys(providers).join(", ")}`);
  return load();
}
