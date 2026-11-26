// Portal SDKs ask games to go silent during ads and while the tab is hidden.
// Games synthesise sound through Web Audio, so every AudioContext created on the page is tracked
// here and suspended or resumed as a group. Import this module before any game code runs.

const contexts = new Set<AudioContext>();
const reasons = new Set<string>();

const Native = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

if (Native) {
  class TrackedAudioContext extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      contexts.add(this);
      if (reasons.size) void this.suspend().catch(() => undefined);
    }
  }
  window.AudioContext = TrackedAudioContext;
}

function apply() {
  for (const ctx of contexts) {
    if (reasons.size) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  }
}

/** Silence all game audio while `reason` holds. Several reasons can overlap (ad + hidden tab). */
export function setSilenced(reason: string, silenced: boolean) {
  if (silenced) reasons.add(reason);
  else reasons.delete(reason);
  apply();
}

document.addEventListener("visibilitychange", () => setSilenced("hidden", document.hidden));
