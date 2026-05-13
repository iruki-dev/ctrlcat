import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { useSound } from "../../components/games/SoundContext";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Status = "idle" | "playing" | "dead";
type Difficulty = "easy" | "normal" | "hard" | "insane";

const OPPOSITE: Record<Dir, Dir> = {
  up: "down", down: "up", left: "right", right: "left",
};
const DELTA: Record<Dir, Point> = {
  right: { x: 1, y: 0 }, left: { x: -1, y: 0 },
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
};

const DIFF: Record<Difficulty, { label: string; baseMs: number; minMs: number; desc: string }> = {
  easy:   { label: "Easy",   baseMs: 240, minMs: 110, desc: "Relaxed pace — great to start" },
  normal: { label: "Normal", baseMs: 150, minMs: 65,  desc: "Classic Snake experience" },
  hard:   { label: "Hard",   baseMs: 90,  minMs: 40,  desc: "Fast and unforgiving" },
  insane: { label: "Insane", baseMs: 55,  minMs: 22,  desc: "Not for the faint-hearted" },
};

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

interface GameState {
  status: Status;
  snake: Point[]; prevSnake: Point[];
  dir: Dir; nextDir: Dir;
  food: Point;
  score: number; best: number;
  accum: number; particles: Particle[]; shake: number;
  difficulty: Difficulty;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function randomFood(snake: Point[]): Point {
  let pt: Point;
  do { pt = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (snake.some(s => s.x === pt.x && s.y === pt.y));
  return pt;
}

function spawnParticles(x: number, y: number, count = 14): Particle[] {
  const colors = ["#f472b6", "#e879f9", "#c084fc", "#a78bfa", "#fb7185", "#f9a8d4"];
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 110;
    const life = 0.45 + Math.random() * 0.3;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
             life, maxLife: life, size: 2.5 + Math.random() * 3,
             color: colors[Math.floor(Math.random() * colors.length)] };
  });
}

function newGame(best = 0, difficulty: Difficulty = "normal"): GameState {
  const snake: Point[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  return { status: "idle", snake, prevSnake: snake.map(p => ({ ...p })),
           dir: "right", nextDir: "right", food: randomFood(snake),
           score: 0, best, accum: 0, particles: [], shake: 0, difficulty };
}

// Snake body: head is bright violet, tail fades to near-black
function segmentColor(i: number, total: number, dead: boolean): string {
  const t = total > 1 ? Math.min(i / (total * 0.6), 1) : 0;
  if (dead) {
    const v = Math.round(lerp(80, 25, t));
    return `rgb(${v},${v-5},${v+10})`;
  }
  const r = Math.round(lerp(139, 49, t));
  const g = Math.round(lerp(92, 10, t));
  const b = Math.round(lerp(246, 90, t));
  return `rgb(${r},${g},${b})`;
}

function drawEyesAt(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: Dir) {
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

function ArrowBtn({ dir, onPress }: { dir: Dir; onPress: () => void }) {
  const paths: Record<Dir, string> = {
    up:    "M12 17V7M7 12l5-5 5 5",
    down:  "M12 7v10M7 12l5 5 5-5",
    left:  "M17 12H7M12 7l-5 5 5 5",
    right: "M7 12h10M12 7l5 5-5 5",
  };
  return (
    <button
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/25 transition-colors select-none"
      aria-label={dir}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d={paths[dir]}/>
      </svg>
    </button>
  );
}

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [uiStatus, setUiStatus] = useState<Status>("idle");
  const [uiScore, setUiScore] = useState(0);
  const [uiBest, setUiBest] = useState(0);
  const [uiNewBest, setUiNewBest] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [displaySize, setDisplaySize] = useState(W);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDisplaySize(Math.floor(Math.min(width, height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useRef<GameState>(newGame());
  const { consume } = useKeys();
  const { play } = useSound();
  const playRef = useRef(play);
  playRef.current = play;

  const setNextDir = useCallback((dir: Dir) => {
    const s = g.current;
    if (s.status === "playing" && dir !== OPPOSITE[s.dir]) s.nextDir = dir;
  }, []);

  useSwipe(useCallback((dir) => {
    setNextDir(dir as Dir);
  }, [setNextDir]));

  const start = useCallback(() => {
    const best = g.current.best;
    g.current = newGame(best, difficulty);
    g.current.status = "playing";
    setUiScore(0);
    setUiNewBest(false);
    setUiStatus("playing");
  }, [difficulty]);

  useGameLoop(canvasRef, {
    update(dt) {
      const s = g.current;
      s.particles = s.particles
        .map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 180 * dt, life: p.life - dt }))
        .filter(p => p.life > 0);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 18);
      if (s.status !== "playing") return;

      const tryDir = (d: Dir) => { if (d !== OPPOSITE[s.dir]) s.nextDir = d; };
      if (consume("ArrowUp")    || consume("w") || consume("W")) tryDir("up");
      if (consume("ArrowDown")  || consume("s") || consume("S")) tryDir("down");
      if (consume("ArrowLeft")  || consume("a") || consume("A")) tryDir("left");
      if (consume("ArrowRight") || consume("d") || consume("D")) tryDir("right");

      s.accum += dt;
      const { baseMs, minMs } = DIFF[s.difficulty];
      const interval = Math.max(minMs, baseMs - s.score * 2.5) / 1000;
      if (s.accum < interval) return;
      s.accum -= interval;

      s.prevSnake = s.snake.map(p => ({ ...p }));
      s.dir = s.nextDir;
      const delta = DELTA[s.dir];
      const head = { x: s.snake[0].x + delta.x, y: s.snake[0].y + delta.y };

      const died = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS
        || s.snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y);

      if (died) {
        const newBest = s.score > s.best;
        s.best = Math.max(s.best, s.score);
        s.status = "dead";
        s.shake = 10;
        playRef.current("die");
        setUiBest(s.best);
        setUiNewBest(newBest && s.score > 0);
        setUiStatus("dead");
        return;
      }

      s.snake = [head, ...s.snake];
      const ate = head.x === s.food.x && head.y === s.food.y;
      if (!ate) {
        s.snake.pop();
      } else {
        s.score += 1;
        setUiScore(s.score);
        s.particles.push(...spawnParticles((s.food.x + 0.5) * CELL, (s.food.y + 0.5) * CELL));
        s.food = randomFood(s.snake);
        playRef.current("eat");
      }
    },

    draw(ctx, w, h) {
      const s = g.current;
      const { baseMs, minMs } = DIFF[s.difficulty];
      const interval = Math.max(minMs, baseMs - s.score * 2.5) / 1000;
      const t = Math.min(s.accum / interval, 1);
      const dead = s.status === "dead";

      let sx = 0, sy = 0;
      if (s.shake > 0) { sx = (Math.random() - 0.5) * s.shake * 2; sy = (Math.random() - 0.5) * s.shake * 2; }

      ctx.save();
      ctx.translate(sx, sy);

      // Background
      ctx.fillStyle = "#0d0818";
      ctx.fillRect(-16, -16, w + 32, h + 32);

      // Grid
      ctx.strokeStyle = "rgba(109,40,217,0.07)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, h); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(w, y * CELL); ctx.stroke(); }

      if (s.status !== "idle") {
        // Food
        const pulse = 1 + Math.sin(Date.now() * 0.007) * 0.14;
        const fx = (s.food.x + 0.5) * CELL, fy = (s.food.y + 0.5) * CELL;
        const fr = (CELL / 2 - 3) * pulse;
        ctx.save();
        ctx.shadowColor = "#f472b6"; ctx.shadowBlur = 18;
        ctx.fillStyle = "#ec4899";
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath(); ctx.arc(fx - fr * 0.3, fy - fr * 0.38, fr * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Particles
        for (const p of s.particles) {
          const alpha = p.life / p.maxLife;
          ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.35 + alpha * 0.65), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // Snake body — drawn segment-by-segment with color gradient
        if (s.snake.length > 0) {
          const pts = s.snake.map((curr, i) => {
            const prev = s.prevSnake[i] ?? curr;
            return { x: (lerp(prev.x, curr.x, t) + 0.5) * CELL, y: (lerp(prev.y, curr.y, t) + 0.5) * CELL };
          });
          const total = pts.length;

          // Outer shadow pass
          ctx.save();
          ctx.shadowColor = dead ? "#2d1b4e" : "#7c3aed";
          ctx.shadowBlur = dead ? 6 : 14;
          ctx.strokeStyle = dead ? "#1a0d30" : "#3b0764";
          ctx.lineWidth = CELL - 1;
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
          ctx.restore();

          // Colored body — each segment individually
          for (let i = 0; i < total - 1; i++) {
            const color = segmentColor(i, total, dead);
            ctx.strokeStyle = color;
            ctx.lineWidth = CELL - 4;
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
            ctx.stroke();
          }

          // Glossy highlight
          ctx.strokeStyle = dead ? "rgba(120,100,160,0.1)" : "rgba(196,181,253,0.2)";
          ctx.lineWidth = CELL - 12;
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();

          // Head
          const head = pts[0];
          ctx.save();
          ctx.shadowColor = dead ? "#4c1d95" : "#a855f7";
          ctx.shadowBlur = dead ? 8 : 22;
          ctx.fillStyle = dead ? "#3b1f6a" : "#6d28d9";
          ctx.beginPath(); ctx.arc(head.x, head.y, CELL / 2 - 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();

          if (!dead) drawEyesAt(ctx, head.x, head.y, s.dir);
        }

        // Death dim
        if (dead) {
          ctx.fillStyle = "rgba(13,8,24,0.68)";
          ctx.fillRect(-16, -16, w + 32, h + 32);
        }
      }

      ctx.restore();
    },
  }, true);

  const level = Math.floor(uiScore / 5) + 1;

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0d0818] flex items-center justify-center touch-none">
      <div className="relative" style={{ width: displaySize, height: displaySize }}>
        <GameCanvas
          ref={canvasRef}
          width={W} height={H}
          cssWidth={displaySize} cssHeight={displaySize}
          className="rounded-2xl border border-violet-900/50 block"
        />

        {/* Live HUD */}
        {uiStatus === "playing" && (
          <div className="absolute top-2 left-2 right-2 flex gap-2 pointer-events-none">
            <div className="bg-black/55 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center min-w-[4rem]">
              <div className="text-[9px] text-violet-400 font-bold uppercase tracking-widest leading-none mb-0.5">Score</div>
              <div className="text-lg font-black text-white tabular-nums leading-none">{uiScore}</div>
            </div>
            <div className="bg-black/55 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center min-w-[4rem]">
              <div className="text-[9px] text-violet-400 font-bold uppercase tracking-widest leading-none mb-0.5">Level</div>
              <div className="text-lg font-black text-white tabular-nums leading-none">{level}</div>
            </div>
            <div className="bg-black/55 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center min-w-[4rem] ml-auto">
              <div className="text-[9px] text-violet-400 font-bold uppercase tracking-widest leading-none mb-0.5">Best</div>
              <div className="text-lg font-black text-white tabular-nums leading-none">{uiBest}</div>
            </div>
          </div>
        )}

        {/* D-pad — always visible during play for touch users */}
        {uiStatus === "playing" && (
          <div className="absolute bottom-3 right-3 grid grid-cols-3 grid-rows-3 gap-1" style={{ width: 120, height: 120 }}>
            <div/>
            <ArrowBtn dir="up" onPress={() => setNextDir("up")} />
            <div/>
            <ArrowBtn dir="left" onPress={() => setNextDir("left")} />
            <div className="w-10 h-10" />
            <ArrowBtn dir="right" onPress={() => setNextDir("right")} />
            <div/>
            <ArrowBtn dir="down" onPress={() => setNextDir("down")} />
            <div/>
          </div>
        )}

        {/* Start screen */}
        {uiStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[#0d0818]/92 backdrop-blur-sm px-5">
            <div className="text-center">
              <p className="text-3xl font-black text-white tracking-tight">Snake</p>
              {uiBest > 0 && (
                <p className="text-sm text-violet-300 mt-1">Best: <span className="font-black text-violet-200">{uiBest}</span></p>
              )}
            </div>

            <div className="w-full flex flex-col gap-2">
              <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest text-center">Difficulty</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(DIFF) as [Difficulty, typeof DIFF.easy][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      difficulty === key
                        ? "border-violet-400 bg-violet-900/60 text-violet-100"
                        : "border-violet-900/40 bg-violet-950/30 text-violet-400 hover:border-violet-700/60"
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-violet-400/70 mt-0.5">{DIFF[difficulty].desc}</p>
            </div>

            <button
              onClick={start}
              className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-black px-10 py-3 rounded-full text-base transition-colors shadow-lg shadow-violet-900/60"
            >
              Start
            </button>
            <p className="text-[11px] text-violet-500">Arrow keys · WASD · Swipe</p>
          </div>
        )}

        {/* Game over screen */}
        {uiStatus === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl px-5">
            <div className="text-center">
              <p className="text-3xl font-black text-white tracking-tight">Game Over</p>
              <p className="text-2xl font-black tabular-nums mt-1" style={{ color: uiNewBest ? "#c084fc" : "#a78bfa" }}>
                {uiScore}
              </p>
              {uiNewBest ? (
                <p className="text-sm text-violet-300 mt-1 font-semibold">New best!</p>
              ) : uiBest > 0 ? (
                <p className="text-xs text-violet-500 mt-1">Best: {uiBest}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <button
                onClick={start}
                className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold px-8 py-2.5 rounded-full text-sm transition-colors"
              >
                Play again
              </button>
              <button
                onClick={() => { g.current.status = "idle"; setUiStatus("idle"); }}
                className="border border-violet-800 text-violet-400 hover:text-violet-200 hover:border-violet-600 font-medium px-8 py-2 rounded-full text-xs transition-colors"
              >
                Change difficulty
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
