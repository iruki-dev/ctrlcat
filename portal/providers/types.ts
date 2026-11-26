import type { GameHost } from "../../src/games/lib/gameEvents";

/** One web game portal integration. Everything is best effort: a failing SDK must never block play. */
export interface PortalProvider {
  name: string;
  /** Load and initialise the portal SDK. Resolves even when it fails. */
  init(): Promise<void>;
  /** Called once the game UI has rendered. */
  loadingFinished?(): void;
  host: GameHost;
}
