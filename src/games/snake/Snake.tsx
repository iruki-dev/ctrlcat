import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const BASE_MS = 150;
const MIN_MS = 55;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Status = "idle" | "playing" | "dead";

const OPPOSITE: Record<Dir, Dir> = {
  up: "down", down: "up", left: "right", right: "left",
};
const DELTA: Record<Dir, Point> = {
  right: { x: 1, y: 0 }, left: { x: -1, y: 0 },
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

interface GameState {
  status: Status;
  snake: Point[];
  prevSnake: Point[];
  dir: Dir;
  nextDir: Dir;
  food: Point;
  score: number;
  best: number;
  accum: number;
  particles: Particle[];
  shake: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function randomFood(snake: Point[]): Point {
  let pt: Point;
  do {
    pt = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some((s) => s.x === pt.x && s.y === pt.y));
  return pt;
}

function spawnParticles(x: number, y: number): Particle[] {
  const colors = ["#f472b6", "#e879f9", "#c084fc", "#a78bfa", "#fb7185", "#f9a8d4"];
  return Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 90;
    const life = 0.45 + Math.random() * 0.3;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: 2.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });
}

function newGame(best = 0): GameState {
  const snake: Point[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  return {
    status: "idle",
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    dir: "right",
    nextDir: "right",
    food: randomFood(snake),
    score: 0,
    best,
    accum: 0,
    particles: [],
    shake: 0,
  };
}

function drawSnakePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
}

function drawEyesAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: Dir
) {
  const off = 4;
  let pairs: [number, number][];
  switch (dir) {
    case "right": pairs = [[cx + 4, cy - off], [cx + 4, cy + off]]; break;
    case "left":  pairs = [[cx - 4, cy - off], [cx - 4, cy + off]]; break;
    case "up":    pairs = [[cx - off, cy - 4], [cx + off, cy - 4]]; break;
    case "down":  pairs = [[cx - off, cy + 4], [cx + off, cy + 4]]; break;
  }
  const pupilDx = dir === "right" ? 0.8 : dir === "left" ? -0.8 : 0;
  const pupilDy = dir === "down" ? 0.8 : dir === "up" ? -0.8 : 0;
  for (const [ex, ey] of pairs) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath(); ctx.arc(ex + pupilDx, ey + pupilDy, 1.4, 0, Math.PI * 2); ctx.fill();
  }
}

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uiStatus, setUiStatus] = useState<Status>("idle");
  const [uiScore, setUiScore] = useState(0);
  const [uiBest, setUiBest] = useState(0);

  const g = useRef<GameState>(newGame());
  const { consume } = useKeys();

  useSwipe(
    useCallback((dir) => {
      const s = g.current;
      if (s.status !== "playing") return;
      if ((dir as Dir) !== OPPOSITE[s.dir]) s.nextDir = dir as Dir;
    }, [])
  );

  const start = useCallback(() => {
    g.current = newGame(g.current.best);
    g.current.status = "playing";
    setUiScore(0);
    setUiStatus("playing");
  }, []);

  useGameLoop(
    canvasRef,
    {
      update(dt) {
        const s = g.current;

        // Particles and shake run even after death
        s.particles = s.particles
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 160 * dt,
            life: p.life - dt,
          }))
          .filter((p) => p.life > 0);

        if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 18);

        if (s.status !== "playing") return;

        const tryDir = (d: Dir) => { if (d !== OPPOSITE[s.dir]) s.nextDir = d; };
        if (consume("ArrowUp")    || consume("w") || consume("W")) tryDir("up");
        if (consume("ArrowDown")  || consume("s") || consume("S")) tryDir("down");
        if (consume("ArrowLeft")  || consume("a") || consume("A")) tryDir("left");
        if (consume("ArrowRight") || consume("d") || consume("D")) tryDir("right");

        s.accum += dt;
        const interval = Math.max(MIN_MS, BASE_MS - s.score * 3) / 1000;
        if (s.accum < interval) return;
        s.accum -= interval;

        // Snapshot positions before moving
        s.prevSnake = s.snake.map((p) => ({ ...p }));

        s.dir = s.nextDir;
        const delta = DELTA[s.dir];
        const head = { x: s.snake[0].x + delta.x, y: s.snake[0].y + delta.y };

        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
          s.best = Math.max(s.best, s.score);
          s.status = "dead";
          s.shake = 9;
          setUiBest(s.best);
          setUiStatus("dead");
          return;
        }
        if (s.snake.slice(0, -1).some((p) => p.x === head.x && p.y === head.y)) {
          s.best = Math.max(s.best, s.score);
          s.status = "dead";
          s.shake = 9;
          setUiBest(s.best);
          setUiStatus("dead");
          return;
        }

        const ate = head.x === s.food.x && head.y === s.food.y;
        s.snake = [head, ...s.snake];
        if (!ate) {
          s.snake.pop();
        } else {
          s.score += 1;
          setUiScore(s.score);
          const px = (s.food.x + 0.5) * CELL;
          const py = (s.food.y + 0.5) * CELL;
          s.particles.push(...spawnParticles(px, py));
          s.food = randomFood(s.snake);
        }
      },

      draw(ctx, w, h) {
        const s = g.current;
        const interval = Math.max(MIN_MS, BASE_MS - s.score * 3) / 1000;
        const t = Math.min(s.accum / interval, 1);

        let shakeX = 0;
        let shakeY = 0;
        if (s.shake > 0) {
          shakeX = (Math.random() - 0.5) * s.shake * 2;
          shakeY = (Math.random() - 0.5) * s.shake * 2;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Dark arcade background
        ctx.fillStyle = "#0d0818";
        ctx.fillRect(-16, -16, w + 32, h + 32);

        // Subtle grid
        ctx.strokeStyle = "rgba(109,40,217,0.09)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, h); ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(w, y * CELL); ctx.stroke();
        }

        if (s.status !== "idle") {
          // Pulsing food
          const pulse = 1 + Math.sin(Date.now() * 0.007) * 0.13;
          const fx = (s.food.x + 0.5) * CELL;
          const fy = (s.food.y + 0.5) * CELL;
          const fr = (CELL / 2 - 3) * pulse;

          ctx.save();
          ctx.shadowColor = "#f472b6";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#ec4899";
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.beginPath();
          ctx.arc(fx - fr * 0.3, fy - fr * 0.36, fr * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Particles
          for (const p of s.particles) {
            const alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 7;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Snake
          if (s.snake.length > 0) {
            const pts = s.snake.map((curr, i) => {
              const prev = s.prevSnake[i] ?? curr;
              return {
                x: (lerp(prev.x, curr.x, t) + 0.5) * CELL,
                y: (lerp(prev.y, curr.y, t) + 0.5) * CELL,
              };
            });

            if (pts.length >= 2) {
              // Outer glow
              ctx.save();
              ctx.shadowColor = "#7c3aed";
              ctx.shadowBlur = 12;
              ctx.strokeStyle = "#3b0764";
              ctx.lineWidth = CELL - 1;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              drawSnakePath(ctx, pts);
              ctx.stroke();
              ctx.restore();

              // Body
              ctx.strokeStyle = "#5b21b6";
              ctx.lineWidth = CELL - 4;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              drawSnakePath(ctx, pts);
              ctx.stroke();

              // Glossy highlight strip
              ctx.strokeStyle = "rgba(167,139,250,0.22)";
              ctx.lineWidth = CELL - 11;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              drawSnakePath(ctx, pts);
              ctx.stroke();
            } else if (pts.length === 1) {
              ctx.save();
              ctx.shadowColor = "#7c3aed";
              ctx.shadowBlur = 12;
              ctx.fillStyle = "#5b21b6";
              ctx.beginPath();
              ctx.arc(pts[0].x, pts[0].y, CELL / 2 - 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Head glow
            const head = pts[0];
            ctx.save();
            ctx.shadowColor = "#a855f7";
            ctx.shadowBlur = 22;
            ctx.fillStyle = "#6d28d9";
            ctx.beginPath();
            ctx.arc(head.x, head.y, CELL / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            drawEyesAt(ctx, head.x, head.y, s.dir);
          }

          // Death dim
          if (s.status === "dead") {
            ctx.fillStyle = "rgba(13,8,24,0.72)";
            ctx.fillRect(-16, -16, w + 32, h + 32);
          }
        }

        ctx.restore();
      },
    },
    true
  );

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="grid grid-cols-2 gap-3 w-full max-w-[400px]">
        <ScoreDisplay label="Score" value={uiScore} />
        <ScoreDisplay label="Best" value={uiBest} />
      </div>

      <div className="relative">
        <GameCanvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-2xl border border-violet-900/60 block"
        />

        {uiStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[#0d0818]/90 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-2xl font-black text-white tracking-tight">Snake</p>
              <p className="text-sm text-violet-300 mt-2">Arrow keys or WASD</p>
              <p className="text-sm text-violet-400 mt-0.5">Swipe on mobile</p>
            </div>
            <GameButton onClick={start} size="lg">
              Start
            </GameButton>
          </div>
        )}

        {uiStatus === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl">
            <div className="text-center">
              <p className="text-2xl font-black text-white tracking-tight">Game Over</p>
              <p className="text-sm text-violet-300 mt-2">
                Score: {uiScore}
                {uiScore > 0 && uiScore === uiBest ? " · New best!" : ""}
              </p>
            </div>
            <GameButton onClick={start} size="lg">
              Play again
            </GameButton>
          </div>
        )}
      </div>

      {uiStatus === "playing" && (
        <p className="text-xs text-game-muted text-center">
          Arrow keys · WASD · Swipe to turn
        </p>
      )}
    </div>
  );
}
