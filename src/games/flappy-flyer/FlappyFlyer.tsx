import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

const BEST_KEY = "ctrlcat.flappy-flyer.best";

/* Logical playfield size. GameCanvas scales this for retina screens. */
const WIDTH = 360;
const HEIGHT = 520;
const GROUND = 44;

/* Flight physics, in logical pixels per second. */
const GRAVITY = 1500;
const FLAP = -440;
const MAX_FALL = 620;

/* Bird */
const BIRD_X = 96;
const BIRD_R = 13;

/* Pipes */
const PIPE_W = 56;
const SPACING = 224;
const BASE_GAP = 172;
const MIN_GAP = 122;
const BASE_SPEED = 152;
const MAX_SPEED = 242;

/* Clearing this many gaps finishes the flight. */
const GOAL = 25;

/* How far the next gap may sit from the previous one. Without this cap two
   neighbouring gaps can ask for more climb than a bird can manage in the
   time between them. */
const MAX_DRIFT = 96;

/* Canvas colours. The violet/pink game palette, hand-mixed for the sky. */
const SKY_TOP = "#faf5ff";
const SKY_BOTTOM = "#ede9fe";
const CLOUD = "#ffffff";
const PIPE_BODY = "#c084fc";
const PIPE_EDGE = "#a855f7";
const PIPE_CAP = "#8b5cf6";
const DIRT = "#8b5cf6";
const DIRT_DARK = "#7c3aed";
const BIRD_BODY = "#f472b6";
const BIRD_WING = "#fbcfe8";
const BIRD_BEAK = "#fb923c";
const INK = "#4c1d95";

type Phase = "idle" | "playing" | "paused" | "won" | "lost";

interface Pipe {
  x: number;
  /** Top of the gap, in logical pixels. */
  gapY: number;
  gap: number;
  scored: boolean;
}

interface World {
  y: number;
  vy: number;
  /** Seconds since the last flap, used to animate the wing. */
  sinceFlap: number;
  elapsed: number;
  pipes: Pipe[];
  score: number;
  clouds: { x: number; y: number; r: number; speed: number }[];
}

/** Gaps narrow and pipes speed up as the score climbs. */
function gapFor(score: number): number {
  return Math.max(MIN_GAP, BASE_GAP - score * 2);
}
function speedFor(score: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + score * 3.6);
}

function makePipe(x: number, score: number, prevGapY?: number): Pipe {
  const gap = gapFor(score);
  const margin = 56;
  const lo = margin;
  const hi = Math.max(lo, HEIGHT - GROUND - gap - margin);
  /* Stay within reach of the previous gap, then clamp back into the playfield. */
  const low = prevGapY === undefined ? lo : Math.max(lo, prevGapY - MAX_DRIFT);
  const high = prevGapY === undefined ? hi : Math.min(hi, prevGapY + MAX_DRIFT);
  const gapY = low + Math.random() * Math.max(high - low, 1);
  return { x, gapY, gap, scored: false };
}

function freshWorld(): World {
  const first = makePipe(WIDTH + 90, 0);
  return {
    y: HEIGHT * 0.42,
    vy: FLAP * 0.55,
    sinceFlap: 0,
    elapsed: 0,
    pipes: [first, makePipe(WIDTH + 90 + SPACING, 0, first.gapY)],
    score: 0,
    clouds: [
      { x: 60, y: 90, r: 26, speed: 16 },
      { x: 210, y: 160, r: 20, speed: 11 },
      { x: 320, y: 70, r: 32, speed: 20 },
    ],
  };
}

export default function FlappyFlyer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const { consume } = useKeys();
  const worldRef = useRef<World>(freshWorld());
  /* Flaps queued by pointer or swipe, drained by the next update tick. */
  const flapRef = useRef(0);
  /* Timestamp before which the keyboard cannot restart a run, so that the tap
     that killed you does not skip past the result screen. */
  const keyLockRef = useRef(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (raw) setBest(Number(raw) || 0);
    } catch {
      /* storage unavailable, best score stays in memory */
    }
  }, []);

  const saveBest = useCallback((value: number) => {
    setBest((prev) => {
      if (value <= prev) return prev;
      try {
        window.localStorage.setItem(BEST_KEY, String(value));
      } catch {
        /* storage unavailable, best score stays in memory */
      }
      return value;
    });
  }, []);

  const startGame = useCallback(() => {
    worldRef.current = freshWorld();
    flapRef.current = 0;
    setScore(0);
    setPhase("playing");
  }, []);

  const endGame = useCallback(
    (won: boolean) => {
      saveBest(worldRef.current.score);
      keyLockRef.current = performance.now() + 700;
      setPhase(won ? "won" : "lost");
    },
    [saveBest],
  );

  const flap = useCallback(() => {
    flapRef.current += 1;
  }, []);

  useSwipe((dir) => {
    if (dir === "up") flap();
  });

  /* Space and Enter also start or restart a run from the panels. */
  useEffect(() => {
    if (phase === "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter" && e.key !== "ArrowUp") return;
      e.preventDefault();
      if (performance.now() < keyLockRef.current) return;
      if (phase === "paused") setPhase("playing");
      else startGame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, startGame]);

  useGameLoop(
    canvasRef,
    {
      update(dt) {
        const w = worldRef.current;
        w.elapsed += dt;

        if (consume("p") || consume("P") || consume("Escape")) {
          setPhase("paused");
          return;
        }

        /* One flap per press, however it arrived. */
        let flaps = flapRef.current;
        flapRef.current = 0;
        if (consume(" ") || consume("ArrowUp") || consume("w") || consume("W")) flaps += 1;
        if (flaps > 0) {
          w.vy = FLAP;
          w.sinceFlap = 0;
        } else {
          w.sinceFlap += dt;
        }

        w.vy = Math.min(w.vy + GRAVITY * dt, MAX_FALL);
        w.y += w.vy * dt;

        for (const c of w.clouds) {
          c.x -= c.speed * dt;
          if (c.x < -c.r * 2) {
            c.x = WIDTH + c.r * 2;
            c.y = 50 + Math.random() * 150;
          }
        }

        const speed = speedFor(w.score);
        let rightmost = 0;
        for (const p of w.pipes) {
          p.x -= speed * dt;
          rightmost = Math.max(rightmost, p.x);
          if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
            p.scored = true;
            w.score += 1;
            setScore(w.score);
          }
        }
        const last = w.pipes.reduce<Pipe | null>(
          (acc, p) => (acc === null || p.x > acc.x ? p : acc),
          null,
        );
        w.pipes = w.pipes.filter((p) => p.x + PIPE_W > -20);
        if (rightmost < WIDTH - SPACING) {
          w.pipes.push(makePipe(rightmost + SPACING, w.score, last?.gapY));
        }

        /* Ceiling and ground are both fatal. */
        if (w.y - BIRD_R <= 0 || w.y + BIRD_R >= HEIGHT - GROUND) {
          w.y = Math.max(BIRD_R, Math.min(w.y, HEIGHT - GROUND - BIRD_R));
          endGame(false);
          return;
        }

        for (const p of w.pipes) {
          const overlapX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
          if (!overlapX) continue;
          if (w.y - BIRD_R < p.gapY || w.y + BIRD_R > p.gapY + p.gap) {
            endGame(false);
            return;
          }
        }

        if (w.score >= GOAL) {
          endGame(true);
        }
      },

      draw(ctx, width, height) {
        const w = worldRef.current;

        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, SKY_TOP);
        sky.addColorStop(1, SKY_BOTTOM);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = CLOUD;
        ctx.globalAlpha = 0.75;
        for (const c of w.clouds) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.arc(c.x + c.r * 0.9, c.y + 4, c.r * 0.7, 0, Math.PI * 2);
          ctx.arc(c.x - c.r * 0.9, c.y + 6, c.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (const p of w.pipes) {
          const bottomY = p.gapY + p.gap;
          ctx.fillStyle = PIPE_BODY;
          ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
          ctx.fillRect(p.x, bottomY, PIPE_W, height - GROUND - bottomY);
          ctx.fillStyle = PIPE_EDGE;
          ctx.fillRect(p.x + PIPE_W - 10, 0, 10, p.gapY);
          ctx.fillRect(p.x + PIPE_W - 10, bottomY, 10, height - GROUND - bottomY);
          ctx.fillStyle = PIPE_CAP;
          ctx.fillRect(p.x - 4, p.gapY - 16, PIPE_W + 8, 16);
          ctx.fillRect(p.x - 4, bottomY, PIPE_W + 8, 16);
        }

        /* Ground strip with a scrolling texture, so speed reads clearly. */
        ctx.fillStyle = DIRT;
        ctx.fillRect(0, height - GROUND, width, GROUND);
        ctx.fillStyle = DIRT_DARK;
        const offset = (w.elapsed * speedFor(w.score)) % 28;
        for (let x = -offset; x < width; x += 28) {
          ctx.fillRect(x, height - GROUND + 12, 14, 6);
        }

        /* Bird: tilts with vertical speed, wing beats just after a flap. */
        const tilt = Math.max(-0.5, Math.min(0.9, w.vy / 700));
        ctx.save();
        ctx.translate(BIRD_X, w.y);
        ctx.rotate(tilt);
        ctx.fillStyle = BIRD_BODY;
        ctx.beginPath();
        ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BIRD_WING;
        const wing = w.sinceFlap < 0.12 ? -7 : 3;
        ctx.beginPath();
        ctx.ellipse(-3, wing, 8, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BIRD_BEAK;
        ctx.beginPath();
        ctx.moveTo(BIRD_R + 2, -1);
        ctx.lineTo(BIRD_R + 11, 2);
        ctx.lineTo(BIRD_R + 2, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(5, -4, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = INK;
        ctx.font = "bold 34px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.globalAlpha = 0.85;
        ctx.fillText(String(w.score), width / 2, 56);
        ctx.globalAlpha = 1;
      },
    },
    phase === "playing",
  );

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Keep the bird in the air with one button. Every tap lifts it, gravity does the rest.
          </p>
          <p className="text-game-text-dim">
            Fly through {GOAL} gaps to finish the flight. Touching a pipe, the ground or the sky ends
            the run.
          </p>
        </div>
        <GameMessage type="hint">
          Space, arrow up or a click flaps. Short, steady taps beat long ones.
        </GameMessage>
        <GameButton onClick={startGame} size="xl" autoFocus>
          Start Game
        </GameButton>
        {best > 0 && <ScoreDisplay label="Best" value={best} size="sm" />}
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Gaps cleared" value={score} size="lg" highlight />
          <ScoreDisplay label="Best" value={best} size="lg" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `Flight complete. You cleared all ${GOAL} gaps.`
            : score === 0
              ? "Down on the first gap. Tap a little earlier next time."
              : `Crashed after ${score} ${score === 1 ? "gap" : "gaps"}.`}
        </GameMessage>
        <GameButton onClick={startGame} size="xl" autoFocus>
          Play again
        </GameButton>
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          Back to start
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} size="sm" highlight />
        <ScoreDisplay label="Goal" value={`${score}/${GOAL}`} size="sm" />
        <ScoreDisplay label="Best" value={best} size="sm" />
      </div>

      <div
        className="relative select-none touch-none cursor-pointer"
        onPointerDown={(e) => {
          e.preventDefault();
          if (phase === "paused") setPhase("playing");
          else flap();
        }}
        role="presentation"
      >
        <GameCanvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-auto rounded-2xl border-2 border-game-border"
        />
        {phase === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-game-bg/80 animate-fade-in">
            <span className="text-lg font-bold text-game-text">Paused</span>
            <span className="text-sm text-game-text-dim">Click or press space to resume</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-game-text-dim">Space or click to flap, P to pause</span>
        <div className="flex gap-2">
          <GameButton
            variant="secondary"
            size="sm"
            onClick={() => setPhase(phase === "paused" ? "playing" : "paused")}
          >
            {phase === "paused" ? "Resume" : "Pause"}
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Quit
          </GameButton>
        </div>
      </div>
    </div>
  );
}
