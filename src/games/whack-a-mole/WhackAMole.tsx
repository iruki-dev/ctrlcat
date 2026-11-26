import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
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

const messages = {
  en: {
    ...common.en,
    intro1: "Moles pop out of nine holes. Hit them before they duck back down.",
    intro2: (target: number) =>
      `You get 30 seconds. Land ${target} hits to win the round. Every swing at an empty hole costs you one second, so aim before you swing.`,
    intro3: "Click or tap a hole, or use the keys 1-9.",
    hits: "Hits",
    won: (hits: number) => `You cleared the round with ${hits} hits.`,
    lost: (target: number, hits: number) => `Time is up. You needed ${target} hits and landed ${hits}.`,
    bestStreak: "Best streak",
    misses: "Misses",
    streak: "Streak",
    hole: (n: number, up: boolean) => `Hole ${n}, ${up ? "mole up" : "empty"}`,
    help: "Keys 1-9 hit the matching hole. An empty swing costs one second.",
  },
  ko: {
    ...common.ko,
    intro1: "구멍 아홉 개에서 두더지가 튀어나옵니다. 숨기 전에 잡으세요.",
    intro2: (target: number) =>
      `제한 시간은 30초이며, ${target}번 맞히면 승리합니다. 빈 구멍을 치면 1초가 줄어드니 잘 보고 치세요.`,
    intro3: "구멍을 클릭하거나 탭하세요. 숫자 1~9 키도 쓸 수 있습니다.",
    hits: "맞힌 수",
    won: (hits: number) => `${hits}번 맞혀 라운드를 통과했습니다.`,
    lost: (target: number, hits: number) => `시간이 끝났습니다. ${target}번이 필요했는데 ${hits}번 맞혔습니다.`,
    bestStreak: "최고 연속",
    misses: "헛스윙",
    streak: "연속",
    hole: (n: number, up: boolean) => `${n}번 구멍, ${up ? "두더지 있음" : "비어 있음"}`,
    help: "숫자 1~9 키로 같은 번호의 구멍을 칩니다. 빈 구멍을 치면 1초가 줄어듭니다.",
  },
};

export default function WhackAMole() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [view, setView] = useState<View>(() =>
    snapshot(createEngine(0), 0),
  );
  const engineRef = useRef<Engine>(createEngine(0));
  const pointerUsed = useRef(false);
  usePhaseEvents(phase, { score: view.score });

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
          if (phase === "idle") startGame();
          else afterBreak(startGame);
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
          <p className="text-game-text">{m.intro1}</p>
          <p className="text-game-text-dim text-sm">{m.intro2(TARGET)}</p>
          <p className="text-game-text-dim text-sm">{m.intro3}</p>
        </div>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
        {bestScore !== null && (
          <ScoreDisplay label={m.best} value={bestScore} size="sm" />
        )}
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label={m.hits} value={view.score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won(view.score)
            : m.lost(TARGET, view.score)}
        </GameMessage>
        <div className="grid grid-cols-3 gap-3 w-full">
          <ScoreDisplay label={m.bestStreak} value={view.bestStreak} size="sm" />
          <ScoreDisplay label={m.misses} value={view.misses} size="sm" />
          <ScoreDisplay label={m.best} value={bestScore ?? "-"} size="sm" />
        </div>
        <GameButton onClick={() => afterBreak(startGame)} size="xl">
          {m.playAgain}
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label={m.time} value={seconds} highlight />
        <ScoreDisplay label={m.hits} value={`${view.score}/${TARGET}`} />
        <ScoreDisplay label={m.streak} value={view.streak} />
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
            aria-label={m.hole(i + 1, hole.up)}
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
        {m.help}
      </p>

      <GameButton variant="ghost" size="sm" onClick={quitGame}>
        {m.quit}
      </GameButton>
    </div>
  );
}
