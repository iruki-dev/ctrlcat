import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";

export type SoundType = "eat" | "die" | "win" | "place" | "draw" | "correct" | "wrong" | "lose";

interface SoundCtx {
  muted: boolean;
  toggleMute: () => void;
  play: (type: SoundType) => void;
}

const Ctx = createContext<SoundCtx>({ muted: false, toggleMute: () => {}, play: () => {} });

function tone(
  ctx: AudioContext,
  freq: number,
  oscType: OscillatorType = "sine",
  startOffset = 0,
  duration = 0.15,
  volume = 0.22,
  freqEnd?: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = oscType;
  const s = ctx.currentTime + startOffset;
  const e = s + duration;
  osc.frequency.setValueAtTime(freq, s);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, e - 0.01);
  gain.gain.setValueAtTime(volume, s);
  gain.gain.exponentialRampToValueAtTime(0.001, e);
  osc.start(s);
  osc.stop(e + 0.01);
}

function synth(ctx: AudioContext, type: SoundType) {
  switch (type) {
    case "eat":
      tone(ctx, 440, "square", 0, 0.09, 0.18, 880);
      break;
    case "die":
      tone(ctx, 300, "sawtooth", 0, 0.42, 0.28, 60);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, "sine", i * 0.1, 0.22, 0.2));
      break;
    case "place":
      tone(ctx, 700, "sine", 0, 0.07, 0.15, 350);
      break;
    case "draw":
      tone(ctx, 330, "sine", 0, 0.1, 0.15);
      tone(ctx, 440, "sine", 0.07, 0.1, 0.15);
      break;
    case "correct":
      [440, 554, 659].forEach((f, i) => tone(ctx, f, "sine", i * 0.07, 0.18, 0.18));
      break;
    case "wrong":
      tone(ctx, 200, "square", 0, 0.1, 0.12);
      break;
    case "lose":
      tone(ctx, 330, "sawtooth", 0, 0.5, 0.25, 110);
      break;
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem("game-muted") === "true";
  });
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  // Eagerly unlock the AudioContext on first user interaction so sounds triggered
  // from rAF callbacks (not user gestures) work without delay.
  useEffect(() => {
    const unlock = () => {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  const play = useCallback(
    (type: SoundType) => {
      if (muted) return;
      const ctx = getCtx();
      const doPlay = () => {
        try { synth(ctx, type); } catch (_) {}
      };
      // If context is still suspended (e.g. first call from rAF before user gesture),
      // wait for resume before scheduling notes.
      if (ctx.state === "suspended") {
        ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    },
    [muted, getCtx]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("game-muted", String(next));
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ muted, toggleMute, play }}>{children}</Ctx.Provider>;
}

export function useSound() {
  return useContext(Ctx);
}
