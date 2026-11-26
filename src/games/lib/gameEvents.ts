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
let breakPending = false;

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
 * Calls made while a break is still running are ignored, so a double click or a repeated key
 * cannot start two rounds or ask for two breaks.
 */
export function afterBreak(fn: () => void) {
  if (!host?.requestBreak) {
    fn();
    return;
  }
  if (breakPending) return;
  breakPending = true;
  emitGameEvent({ type: "gameplayStop" });
  let pending: Promise<void>;
  try {
    pending = host.requestBreak();
  } catch {
    pending = Promise.resolve();
  }
  Promise.resolve(pending)
    .catch(() => undefined)
    .then(() => {
      breakPending = false;
      fn();
    });
}

/**
 * Emits gameplayStart / gameplayStop / roundEnd from a game's phase value.
 * `playing` is the phase name used while the player is in a round.
 * `paused` phases stop gameplay without ending the round; going back to a playing phase resumes it.
 * Phases listed in `won` / `lost` end the round with that outcome; any other phase outside the round is "done".
 * Going back to "idle" (quitting to the menu) stops gameplay without a roundEnd.
 */
export function usePhaseEvents(
  phase: string,
  opts: {
    playing?: string | string[];
    paused?: string[];
    won?: string[];
    lost?: string[];
    score?: number;
  } = {},
) {
  const prev = useRef(phase);
  const playing = Array.isArray(opts.playing) ? opts.playing : [opts.playing ?? "playing"];
  const paused = opts.paused ?? [];
  const won = opts.won ?? ["won"];
  const lost = opts.lost ?? ["lost"];
  const score = opts.score;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const wasActive = playing.includes(prev.current);
    const isActive = playing.includes(phase);
    const wasInRound = wasActive || paused.includes(prev.current);
    const isInRound = isActive || paused.includes(phase);
    if (!wasActive && isActive) emitGameEvent({ type: "gameplayStart" });
    if (wasActive && !isActive) emitGameEvent({ type: "gameplayStop" });
    if (wasInRound && !isInRound) {
      const outcome = won.includes(phase) ? "won" : lost.includes(phase) ? "lost" : "done";
      if (outcome !== "done" || phase !== "idle") {
        emitGameEvent({ type: "roundEnd", outcome, score: scoreRef.current });
      }
    }
    prev.current = phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
}
