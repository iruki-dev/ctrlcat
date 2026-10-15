import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won" | "lost";

const HOLES = 9;
const ROUND_MS = 30000;
const TARGET = 20;
const MISS_PENALTY_MS = 1000;

/* Row-major keyboard shortcuts: number row and the QWE / ASD / ZXC block */
const KEY_MAP: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2,
  Digit4: 3, Digit5: 4, Digit6: 5,
  Digit7: 6, Digit8: 7, Digit9: 8,
  KeyQ: 0, KeyW: 1, KeyE: 2,
  KeyA: 3, KeyS: 4, KeyD: 5,
  KeyZ: 6, KeyX: 7, KeyC: 8,
};

type Mole = { id: number; downAt: number; whacked: boolean };

type Engine = {
  holes: (Mole | null)[];
  timeLeftMs: number;
  score: number;
  misses: number;
  streak: number;
  bestStreak: number;
  nextSpawnAt: number;
  nextId: number;
  missHole: number | null;
  missUntil: number;
};

type HoleView = { up: boolean; whacked: boolean; miss: boolean };

type View = {
  holes: HoleView[];
  timeLeftMs: number;
  score: number;
  misses: number;
  streak: number;
  bestStreak: number;
};

function createEngine(now: number): Engine {
  return {
    holes: Array.from({ length: HOLES }, () => null),
    timeLeftMs: ROUND_MS,
    score: 0,
    misses: 0,
    streak: 0,
    bestStreak: 0,
    nextSpawnAt: now + 500,
    nextId: 1,
    missHole: null,
    missUntil: 0,
  };
}

function snapshot(e: Engine, now: number): View {
  return {
    holes: e.holes.map((mole, i) => ({
      up: mole !== null,
      whacked: mole !== null && mole.whacked,
      miss: e.missHole === i && now < e.missUntil,
    })),
    timeLeftMs: Math.max(0, e.timeLeftMs),
    score: e.score,
    misses: e.misses,
    streak: e.streak,
    bestStreak: e.bestStreak,
  };
}

/* The better you do, the shorter the window and the busier the board */
const upTime = (score: number) => Math.max(520, 1250 - score * 32);
const spawnGap = (score: number) => Math.max(380, 950 - score * 26);
const maxUp = (score: number) => (score >= 14 ? 3 : score >= 6 ? 2 : 1);

export default function WhackAMole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [view, setView] = useState<View>(() =>
    snapshot(createEngine(0), 0),
  );
  const engineRef = useRef<Engine>(createEngine(0));
  const pointerUsed = useRef(false);

  const startGame = useCallback(() => {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    engineRef.current = createEngine(now);
    setView(snapshot(engineRef.current, now));
    setPhase("playing");
  }, []);

  const quitGame = useCallback(() => {
    setPhase("idle");
  }, []);

  /* Game clock: moles rise, duck away and spawn again on a tightening schedule */
  useEffect(() => {
    if (phase !== "playing") return;
    let last = typeof performance !== "undefined" ? performance.now() : 0;
    const id = window.setInterval(() => {
      const e = engineRef.current;
      const now = performance.now();
      const dt = Math.min(now - last, 250);
      last = now;
      e.timeLeftMs -= dt;

      for (let i = 0; i < HOLES; i += 1) {
        const mole = e.holes[i] ?? null;
        if (mole && now >= mole.downAt) {
          if (!mole.whacked) e.streak = 0;
          e.holes[i] = null;
        }
      }

      if (now >= e.nextSpawnAt) {
        const free: number[] = [];
        let active = 0;
        for (let i = 0; i < HOLES; i += 1) {
          if ((e.holes[i] ?? null) === null) free.push(i);
          else active += 1;
        }
        if (free.length > 0 && active < maxUp(e.score)) {
          const pick = free[Math.floor(Math.random() * free.length)] ?? free[0] ?? 0;
          e.holes[pick] = {
            id: e.nextId,
            downAt: now + upTime(e.score),
            whacked: false,
          };
          e.nextId += 1;
        }
        e.nextSpawnAt = now + spawnGap(e.score);
      }

      if (e.timeLeftMs <= 0) {
        e.timeLeftMs = 0;
        e.holes = Array.from({ length: HOLES }, () => null);
        setView(snapshot(e, now));
        setBestScore((prev) => (prev === null || e.score > prev ? e.score : prev));
        setPhase(e.score >= TARGET ? "won" : "lost");
        return;
      }

      setView(snapshot(e, now));
    }, 50);
    return () => window.clearInterval(id);
  }, [phase]);

  const whack = useCallback(
    (hole: number) => {
      if (phase !== "playing") return;
      const e = engineRef.current;
      const now = performance.now();
      const mole = e.holes[hole] ?? null;
      if (mole && !mole.whacked) {
        mole.whacked = true;
        mole.downAt = now + 170;
        e.score += 1;
        e.streak += 1;
        if (e.streak > e.bestStreak) e.bestStreak = e.streak;
      } else if (!mole) {
        e.misses += 1;
        e.streak = 0;
        e.timeLeftMs = Math.max(1, e.timeLeftMs - MISS_PENALTY_MS);
        e.missHole = hole;
        e.missUntil = now + 220;
      }
      setView(snapshot(e, now));
    },
    [phase],
  );

  /* Keyboard play: 1-9 or QWE/ASD/ZXC hit a hole, space starts a round */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        if (phase !== "playing") {
          event.preventDefault();
          startGame();
        }
        return;
      }
      if (event.code === "Escape" && phase === "playing") {
        quitGame();
        return;
      }
      if (phase !== "playing" || event.metaKey || event.ctrlKey || event.altKey) return;
      const hole = KEY_MAP[event.code];
      if (hole === undefined) return;
      event.preventDefault();
      whack(hole);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, startGame, quitGame, whack]);

  const seconds = (view.timeLeftMs / 1000).toFixed(1);
  const timePct = Math.max(0, Math.min(100, (view.timeLeftMs / ROUND_MS) * 100));

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text">
            Moles pop out of nine holes. Hit them before they duck back down.
          </p>
          <p className="text-game-text-dim text-sm">
            You get 30 seconds. Land {TARGET} hits to win the round. Every swing
            at an empty hole costs you one second, so aim before you swing.
          </p>
          <p className="text-game-text-dim text-sm">
            Click or tap a hole, or use the keys 1-9.
          </p>
        </div>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
        {bestScore !== null && (
          <ScoreDisplay label="Best" value={bestScore} size="sm" />
        )}
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Hits" value={view.score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `You cleared the round with ${view.score} hits.`
            : `Time is up. You needed ${TARGET} hits and landed ${view.score}.`}
        </GameMessage>
        <div className="grid grid-cols-3 gap-3 w-full">
          <ScoreDisplay label="Best streak" value={view.bestStreak} size="sm" />
          <ScoreDisplay label="Misses" value={view.misses} size="sm" />
          <ScoreDisplay label="Best" value={bestScore ?? "—"} size="sm" />
        </div>
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Time" value={seconds} highlight />
        <ScoreDisplay label="Hits" value={`${view.score}/${TARGET}`} />
        <ScoreDisplay label="Streak" value={view.streak} />
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-game-accent/15">
        <div
          className="h-full rounded-full bg-game-accent transition-[width] duration-75 ease-linear"
          style={{ width: `${timePct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 select-none">
        {view.holes.map((hole, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Hole ${i + 1}${hole.up ? ", mole up" : ", empty"}`}
            onPointerDown={() => {
              pointerUsed.current = true;
              whack(i);
            }}
            onClick={() => {
              if (pointerUsed.current) {
                pointerUsed.current = false;
                return;
              }
              whack(i);
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`relative aspect-square overflow-hidden rounded-2xl border-2 bg-game-surface touch-manipulation transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-game-accent ${
              hole.miss
                ? "border-game-secondary bg-game-secondary/10"
                : "border-game-border hover:border-game-accent/60"
            }`}
          >
            <span className="absolute bottom-0 left-1/2 h-1/3 w-4/5 -translate-x-1/2 rounded-t-full bg-game-accent/15" />
            <span
              className={`absolute bottom-0 left-1/2 flex h-2/3 w-2/3 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-t-full transition-transform duration-150 ease-out ${
                hole.up ? "translate-y-0" : "translate-y-full"
              } ${hole.whacked ? "bg-game-secondary" : "bg-game-accent"}`}
            >
              <span className="flex gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-game-surface" />
                <span className="h-1.5 w-1.5 rounded-full bg-game-surface" />
              </span>
              <span className="h-1 w-3 rounded-full bg-game-surface/70" />
            </span>
            <span className="absolute top-1.5 left-2 text-xs font-semibold text-game-text-dim">
              {i + 1}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-game-text-dim">
        Keys 1-9 hit the matching hole. An empty swing costs one second.
      </p>

      <GameButton variant="ghost" size="sm" onClick={quitGame}>
        Quit
      </GameButton>
    </div>
  );
}
