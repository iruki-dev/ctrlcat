import { useEffect, useRef } from "react";

/**
 * Optional hooks for hosts that embed a game outside ctrlcat.dev (for example a web game portal build).
 * On ctrlcat.dev nothing is registered: events go nowhere and breaks run the callback immediately,
 * so the site behaves exactly as before and sends nothing anywhere.
 */
export type GameEvent =
  | { type: "gameplayStart" }
  | { type: "gameplayStop" }
  | { type: "roundEnd"; outcome: "won" | "lost" | "done"; score?: number };

export interface GameHost {
  onEvent?: (event: GameEvent) => void;
  /** Called between rounds. Resolve when the game may continue (after an ad, or right away). */
  requestBreak?: () => Promise<void>;
}

let host: GameHost | null = null;

export function setGameHost(next: GameHost | null) {
  host = next;
}

export function emitGameEvent(event: GameEvent) {
  try {
    host?.onEvent?.(event);
  } catch {
    // A host failure must never break the game.
  }
}

/**
 * Runs `fn` after the host's break between rounds.
 * Without a host (ctrlcat.dev) `fn` runs synchronously, as if this wrapper were not there.
 */
export function afterBreak(fn: () => void) {
  if (!host?.requestBreak) {
    fn();
    return;
  }
  emitGameEvent({ type: "gameplayStop" });
  host
    .requestBreak()
    .catch(() => undefined)
    .then(() => fn());
}

/**
 * Emits gameplayStart / gameplayStop / roundEnd from a game's phase value.
 * `playing` is the phase name used while the player is in a round.
 * Phases listed in `won` / `lost` end the round with that outcome; any other non-playing phase is "done".
 */
export function usePhaseEvents(
  phase: string,
  opts: { playing?: string | string[]; won?: string[]; lost?: string[]; score?: number } = {},
) {
  const prev = useRef(phase);
  const playing = Array.isArray(opts.playing) ? opts.playing : [opts.playing ?? "playing"];
  const won = opts.won ?? ["won"];
  const lost = opts.lost ?? ["lost"];
  const score = opts.score;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const was = playing.includes(prev.current);
    const is = playing.includes(phase);
    if (!was && is) emitGameEvent({ type: "gameplayStart" });
    if (was && !is) {
      emitGameEvent({ type: "gameplayStop" });
      const outcome = won.includes(phase) ? "won" : lost.includes(phase) ? "lost" : "done";
      if (outcome !== "done" || phase !== "idle") {
        emitGameEvent({ type: "roundEnd", outcome, score: scoreRef.current });
      }
    }
    prev.current = phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
}
