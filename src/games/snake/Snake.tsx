import { useRef, useState, useCallback, useEffect, type TouchEvent as ReactTouchEvent } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useBestScore } from "../lib/useBestScore";
import { useSound } from "../../components/games/SoundContext";

/* ---------------------------------------------------------------- constants */

/** Logical pixels per grid cell. The canvas is scaled to fit, so this only sets drawing detail. */
const CELL = 32;
/** The board aims for about this many cells and picks columns and rows to match the screen shape. */
const TARGET_CELLS = 380;
const MIN_SIDE = 12;
const MAX_SIDE = 30;
const QUEUE_MAX = 3;
const START_GRACE = 0.55;
const RESUME_GRACE = 0.35;
const SWIPE_PX = 22;
const DEMO_MAX_LEN = 14;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Status = "idle" | "playing" | "paused" | "dead" | "won";
type Difficulty = "easy" | "normal" | "hard" | "insane";
type RGB = [number, number, number];

const DIRS: Dir[] = ["up", "down", "left", "right"];
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const DELTA: Record<Dir, Point> = {
  right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
};
const ANGLE: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

const DIFF: Record<Difficulty, { baseMs: number; minMs: number }> = {
  easy: { baseMs: 240, minMs: 110 },
  normal: { baseMs: 150, minMs: 65 },
  hard: { baseMs: 90, minMs: 40 },
  insane: { baseMs: 55, minMs: 22 },
};

/* Bright casual look: sand board with a dot grid on a teal stage, green snake, red berry.
   Canvas and inline drawing colors (the allowed hex exception). */
const C = {
  stage: "#1f9e95",
  panel: "rgba(0, 0, 0, 0.18)",
  dim: "rgba(22, 122, 115, 0.82)",
  field: "#f6e7c8",
  dot: "#e3cfa6",
  edge: "#e3cfa6",
  head: [52, 199, 109] as RGB,
  tail: [30, 150, 92] as RGB,
  deadBody: [140, 140, 130] as RGB,
  outline: "#1b7a4a",
  eye: "#ffffff",
  pupil: "#1a1a1a",
  mouth: "#2a1010",
  apple: "#ff4d5e",
  appleLight: "#ff8590",
  appleDark: "#c4283a",
  leaf: "#3aa357",
  stem: "#6b4423",
  shadow: "rgba(90, 60, 20, 0.14)",
  juice: ["#ff4d5e", "#ff8590", "#ffc53d", "#ffffff"],
  popupFill: "#ffffff",
  popupStroke: "#c4283a",
  flash: "255,255,255",
  gold: "#ffc53d",
  button: "#ff7a3d",
  buttonText: "#ffffff",
};

const FONT = "Roboto, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ---------------------------------------------------------------- messages */

const messages = {
  en: {
    ...common.en,
    title: "Snake",
    play: "Play",
    levels: { easy: "Easy", normal: "Normal", hard: "Hard", insane: "Insane" } as Record<Difficulty, string>,
    difficulty: "Speed",
    controlsKeys: "Arrow keys or WASD",
    controlsTouch: "Swipe to turn",
    gameOver: "Game over",
    cleared: "Board cleared!",
    newBest: "New best!",
    menu: "Menu",
    paused: "Paused",
  },
  ko: {
    ...common.ko,
    title: "스네이크",
    play: "시작",
    levels: { easy: "쉬움", normal: "보통", hard: "어려움", insane: "매우 어려움" } as Record<Difficulty, string>,
    difficulty: "속도",
    controlsKeys: "방향키 또는 WASD",
    controlsTouch: "화면을 밀어서 방향 전환",
    gameOver: "게임 오버",
    cleared: "판을 다 채웠습니다!",
    newBest: "최고 기록!",
    menu: "메뉴",
    paused: "일시 정지",
  },
};

type Msgs = typeof messages.en;

/* ---------------------------------------------------------------- state */

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
interface Popup { x: number; y: number; text: string; life: number; }
interface Ring { x: number; y: number; life: number; }
interface Callout { text: string; life: number; }

interface GameState {
  status: Status;
  demo: boolean;
  cols: number; rows: number;
  snake: Point[]; prev: Point[]; grew: boolean;
  dir: Dir; queue: Dir[];
  food: Point; foodBorn: number;
  score: number; prevBest: number; bestCalled: boolean;
  accum: number; interval: number; grace: number; steps: number;
  time: number; headAngle: number;
  particles: Particle[]; popups: Popup[]; rings: Ring[]; bulges: number[];
  callout: Callout | null;
  shake: number; flash: number;
  deathT: number; popped: number; overShown: boolean;
  difficulty: Difficulty;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function mix(a: RGB, b: RGB, t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function easeOutBack(t: number) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

function gridFor(w: number, h: number) {
  const ar = clamp(w / Math.max(1, h), 0.35, 2.8);
  const cols = clamp(Math.round(Math.sqrt(TARGET_CELLS * ar)), MIN_SIDE, MAX_SIDE);
  const rows = clamp(Math.round(TARGET_CELLS / cols), MIN_SIDE, MAX_SIDE);
  return { cols, rows };
}

function intervalFor(score: number, d: Difficulty) {
  const { baseMs, minMs } = DIFF[d];
  return Math.max(minMs, baseMs - score * 2.5) / 1000;
}

function randomFood(s: { cols: number; rows: number; snake: Point[] }): Point | null {
  const taken = new Set(s.snake.map(p => p.y * s.cols + p.x));
  const free: number[] = [];
  for (let i = 0; i < s.cols * s.rows; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  return { x: i % s.cols, y: Math.floor(i / s.cols) };
}

function newState(cols: number, rows: number, difficulty: Difficulty, demo: boolean): GameState {
  const cy = Math.floor(rows / 2);
  const cx = Math.max(3, Math.floor(cols / 2) - (demo ? 0 : 2));
  const snake: Point[] = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  const s: GameState = {
    status: demo ? "idle" : "playing", demo, cols, rows,
    snake, prev: snake.map(p => ({ ...p })), grew: false,
    dir: "right", queue: [],
    food: { x: 0, y: 0 }, foodBorn: 0,
    score: 0, prevBest: 0, bestCalled: false,
    accum: 0, interval: intervalFor(0, difficulty), grace: demo ? 0 : START_GRACE, steps: 0,
    time: 0, headAngle: 0,
    particles: [], popups: [], rings: [], bulges: [], callout: null,
    shake: 0, flash: 0, deathT: 0, popped: 0, overShown: false,
    difficulty,
  };
  s.food = randomFood(s) ?? { x: 0, y: 0 };
  return s;
}

function burst(s: GameState, x: number, y: number, count: number, colors: string[], speed = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (90 + Math.random() * 170) * speed;
    const life = 0.4 + Math.random() * 0.35;
    s.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life, maxLife: life,
      size: 2.5 + Math.random() * 3.5, color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  if (s.particles.length > 260) s.particles.splice(0, s.particles.length - 260);
}

/** One grid step. Returns what happened. */
function step(s: GameState): "move" | "eat" | "die" {
  s.prev = s.snake.map(p => ({ ...p }));
  if (s.queue.length) s.dir = s.queue.shift()!;
  const d = DELTA[s.dir];
  const h = s.snake[0];
  const head = { x: h.x + d.x, y: h.y + d.y };
  const hitWall = head.x < 0 || head.x >= s.cols || head.y < 0 || head.y >= s.rows;
  // The tail cell frees up this same step, so it does not count as a collision.
  const hitSelf = s.snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y);
  if (hitWall || hitSelf) { s.grew = false; return "die"; }
  s.snake.unshift(head);
  s.steps++;
  if (head.x === s.food.x && head.y === s.food.y) { s.grew = true; return "eat"; }
  s.snake.pop();
  s.grew = false;
  return "move";
}

/** Attract-mode steering: head for the berry, avoid walls, the body, and dead-end pockets. */
function demoSteer(s: GameState) {
  const head = s.snake[0];
  const body = new Set(s.snake.slice(0, -1).map(p => p.y * s.cols + p.x));
  const space = (start: Point) => {
    const seen = new Set<number>([start.y * s.cols + start.x]);
    const stack = [start];
    while (stack.length && seen.size < 80) {
      const p = stack.pop()!;
      for (const d of DIRS) {
        const q = { x: p.x + DELTA[d].x, y: p.y + DELTA[d].y };
        const k = q.y * s.cols + q.x;
        if (q.x < 0 || q.y < 0 || q.x >= s.cols || q.y >= s.rows || body.has(k) || seen.has(k)) continue;
        seen.add(k); stack.push(q);
      }
    }
    return seen.size;
  };
  let best: Dir | null = null;
  let bestScore = Infinity;
  for (const d of DIRS) {
    if (d === OPPOSITE[s.dir]) continue;
    const n = { x: head.x + DELTA[d].x, y: head.y + DELTA[d].y };
    if (n.x < 0 || n.y < 0 || n.x >= s.cols || n.y >= s.rows || body.has(n.y * s.cols + n.x)) continue;
    let score = Math.abs(n.x - s.food.x) + Math.abs(n.y - s.food.y) + Math.random() * 1.2;
    if (space(n) < s.snake.length + 4) score += 200;
    if (score < bestScore) { bestScore = score; best = d; }
  }
  if (best) s.queue = [best];
}

/* ---------------------------------------------------------------- field */

function buildField(cols: number, rows: number): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio ?? 1);
  const w = cols * CELL, h = rows * CELL;
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = C.field;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = C.dot;
  for (let y = 1; y < rows; y++) for (let x = 1; x < cols; x++) {
    ctx.beginPath(); ctx.arc(x * CELL, y * CELL, 2, 0, Math.PI * 2); ctx.fill();
  }
  return cv;
}

/* ---------------------------------------------------------------- drawing */

function drawBerry(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = CELL * 0.36 * scale;
  if (r <= 0.5) return;
  ctx.fillStyle = C.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.apple;
  ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.appleLight;
  ctx.beginPath(); ctx.ellipse(x - r * 0.45, y - r * 0.2, r * 0.22, r * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
  // stem + leaf
  ctx.strokeStyle = C.stem; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x + 1.5, y - r * 1.05); ctx.stroke();
  ctx.save();
  ctx.translate(x + 2, y - r * 0.9);
  ctx.rotate(-0.5);
  ctx.fillStyle = C.leaf;
  ctx.beginPath(); ctx.ellipse(r * 0.38, 0, r * 0.4, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHead(
  ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number, width: number,
  color: string, dead: boolean, flashing: boolean,
) {
  const a = s.headAngle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const rx = CELL * 0.6, ry = Math.max(width * 0.66, CELL * 0.56);
  // outline + fill
  ctx.fillStyle = flashing ? C.eye : color;
  ctx.beginPath(); ctx.ellipse(CELL * 0.06, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

  // Food direction in head space, for the pupils and the open mouth.
  const fx = (s.food.x + 0.5) * CELL - x, fy = (s.food.y + 0.5) * CELL - y;
  const lx = fx * Math.cos(-a) - fy * Math.sin(-a);
  const ly = fx * Math.sin(-a) + fy * Math.cos(-a);
  const dist = Math.hypot(lx, ly) || 1;
  const near = !s.demo && !dead && lx > 0 && dist < CELL * 2.3 && Math.abs(ly) < CELL * 0.9;

  if (near) {
    ctx.fillStyle = C.mouth;
    ctx.beginPath(); ctx.ellipse(rx * 0.72, 0, rx * 0.26, ry * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }

  // eyes
  const blink = !dead && (s.time % 3.4) > 3.27;
  const er = CELL * 0.19;
  for (const side of [-1, 1]) {
    const ex = CELL * 0.2, ey = side * ry * 0.46;
    if (dead) {
      ctx.strokeStyle = C.pupil; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex - er * 0.7, ey - er * 0.7); ctx.lineTo(ex + er * 0.7, ey + er * 0.7);
      ctx.moveTo(ex + er * 0.7, ey - er * 0.7); ctx.lineTo(ex - er * 0.7, ey + er * 0.7);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = C.eye;
    ctx.beginPath(); ctx.ellipse(ex, ey, er, blink ? er * 0.2 : er, 0, 0, Math.PI * 2); ctx.fill();
    if (!blink) {
      const look = er * 0.42;
      const px = ex + (s.demo ? look * 0.6 : (lx / dist) * look);
      const py = ey + (s.demo ? 0 : (ly / dist) * look);
      ctx.fillStyle = C.pupil;
      ctx.beginPath(); ctx.arc(px, py, er * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.eye;
      ctx.beginPath(); ctx.arc(px - er * 0.2, py - er * 0.22, er * 0.18, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, s: GameState, t: number) {
  const cur = s.snake;
  const n = cur.length;
  const center = (p: Point) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL });
  const pts: Point[] = [];
  const h0 = center(cur[0]);
  const h1 = center(cur[1] ?? cur[0]);
  pts.push({ x: lerp(h1.x, h0.x, t), y: lerp(h1.y, h0.y, t) });
  for (let i = 1; i < n; i++) pts.push(center(cur[i]));
  if (!s.grew && s.prev.length === n) {
    const a = center(s.prev[n - 1]), b = center(cur[n - 1]);
    pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  const dead = s.status === "dead";
  const flashing = dead && s.deathT < 0.3 && Math.floor(s.deathT * 20) % 2 === 0;
  const start = dead ? s.popped : 0;
  const total = pts.length;
  if (start >= total - 1) return;

  const widthAt = (i: number) => {
    const f = i / Math.max(1, total - 1);
    let w = CELL * (0.8 - 0.25 * Math.pow(f, 1.3));
    for (const b of s.bulges) w += CELL * 0.2 * Math.max(0, 1 - Math.abs(i - b) / 1.3);
    return w;
  };
  const rgbAt = (i: number, shade = 1): RGB => {
    const f = i / Math.max(1, total - 1);
    const a = dead ? C.deadBody : C.head, b = dead ? (C.deadBody.map(v => v * 0.6) as RGB) : C.tail;
    return [lerp(a[0], b[0], f) * shade, lerp(a[1], b[1], f) * shade, lerp(a[2], b[2], f) * shade];
  };
  const colorAt = (i: number, shade = 1) => mix(rgbAt(i, shade), rgbAt(i, shade), 0);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.shadow;
  for (let i = total - 2; i >= start; i--) {
    ctx.lineWidth = widthAt(i);
    ctx.beginPath(); ctx.moveTo(pts[i].x + 1, pts[i].y + 3); ctx.lineTo(pts[i + 1].x + 1, pts[i + 1].y + 3); ctx.stroke();
  }
  for (let i = total - 2; i >= start; i--) {
    ctx.strokeStyle = flashing ? C.eye : colorAt(i);
    ctx.lineWidth = widthAt(i);
    ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
  }
  if (start === 0) drawHead(ctx, s, pts[0].x, pts[0].y, widthAt(0), colorAt(0), dead, flashing);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, stroke: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ---------------------------------------------------------------- small UI pieces */

function Svg({ children, className = "w-5 h-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
const TrophyIcon = ({ className }: { className?: string }) => (
  <Svg className={className}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></Svg>
);
const PlayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" /></svg>
);
const ReplayIcon = ({ className }: { className?: string }) => (
  <Svg className={className}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Svg>
);
const PauseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>
);
const SwipeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" /><path d="M12 10V8.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 15.5a1.6 1.6 0 0 1 2.6-1.8L9 16" /><path d="M3 5h3M19 5h2" /></Svg>
);
function KeysIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <rect x="13" y="1" width="10" height="10" rx="2.2" />
      <rect x="1" y="13" width="10" height="10" rx="2.2" />
      <rect x="13" y="13" width="10" height="10" rx="2.2" />
      <rect x="25" y="13" width="10" height="10" rx="2.2" />
      <path d="M18 4l-2 3h4z M6 15.5l-2.5 2.5L6 20.5z M18 20l-2-3h4z M30 15.5l2.5 2.5L30 20.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced || value === 0) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = Math.min(900, 300 + value * 40);
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <>{shown}</>;
}

/* ---------------------------------------------------------------- component */

export default function Snake() {
  const m = useMessages(messages);
  const mRef = useRef<Msgs>(m);
  mRef.current = m;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const areaNow = useRef(area);
  areaNow.current = area;

  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [uiStatus, setUiStatus] = useState<Status>("idle");
  const [uiScore, setUiScore] = useState(0);
  const [uiOver, setUiOver] = useState(false);
  const [uiNewBest, setUiNewBest] = useState(false);
  const [scorePop, setScorePop] = useState(0);
  const [dims, setDims] = useState({ cols: 20, rows: 16 });
  const [touchUi, setTouchUi] = useState(false);
  usePhaseEvents(uiStatus, { playing: "playing", paused: ["paused"], won: ["won"], lost: ["dead"], score: uiScore });

  const { best, record } = useBestScore(`ctrlcat:snake:best:${difficulty}`);
  const bestRef = useRef(best ?? 0);
  bestRef.current = best ?? 0;
  const recordRef = useRef(record);
  recordRef.current = record;

  const { play } = useSound();
  const playRef = useRef(play);
  playRef.current = play;

  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setTouchUi(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  const g = useRef<GameState>(newState(20, 16, "normal", true));
  const field = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  /* Measure the play area; while on the menu the attract-mode board follows the screen shape. */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setArea({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!area.w || !area.h) return;
    const s = g.current;
    if (s.status !== "idle") return;
    const d = gridFor(area.w, area.h);
    if (d.cols !== s.cols || d.rows !== s.rows) {
      g.current = newState(d.cols, d.rows, difficulty, true);
      setDims(d);
    }
  }, [area, difficulty]);

  const start = useCallback(() => {
    const a = areaNow.current;
    const d = a.w && a.h ? gridFor(a.w, a.h) : { cols: g.current.cols, rows: g.current.rows };
    const s = newState(d.cols, d.rows, difficulty, false);
    s.prevBest = bestRef.current;
    g.current = s;
    setDims(d);
    setUiScore(0);
    setUiNewBest(false);
    setUiOver(false);
    setUiStatus("playing");
  }, [difficulty]);

  const toMenu = useCallback(() => {
    const a = areaNow.current;
    const d = a.w && a.h ? gridFor(a.w, a.h) : { cols: g.current.cols, rows: g.current.rows };
    g.current = newState(d.cols, d.rows, difficulty, true);
    setDims(d);
    setUiOver(false);
    setUiStatus("idle");
  }, [difficulty]);

  const pause = useCallback(() => {
    const s = g.current;
    if (s.status !== "playing") return;
    s.status = "paused";
    setUiStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const s = g.current;
    if (s.status !== "paused") return;
    s.status = "playing";
    s.grace = RESUME_GRACE;
    setUiStatus("playing");
  }, []);

  const pushDir = useCallback((d: Dir) => {
    const s = g.current;
    if (s.status === "paused") { resume(); }
    if (s.status !== "playing") return;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d === last || d === OPPOSITE[last]) return;
    if (s.queue.length < QUEUE_MAX) s.queue.push(d);
  }, [resume]);

  /* Keyboard: turns are queued the moment the key goes down, so quick double turns are never lost. */
  const actions = useRef({ start, toMenu, pause, resume, pushDir });
  actions.current = { start, toMenu, pause, resume, pushDir };
  const overRef = useRef(uiOver);
  overRef.current = uiOver;
  useEffect(() => {
    const KEY_DIR: Record<string, Dir> = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = g.current;
      const act = actions.current;
      const dir = KEY_DIR[e.key];
      if (dir) {
        if (s.status === "playing" || s.status === "paused") { e.preventDefault(); act.pushDir(dir); }
        else if (e.key.startsWith("Arrow")) e.preventDefault();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        if (s.status === "idle") act.start();
        else if (s.status === "paused") act.resume();
        else if (s.status === "playing" && e.key === " ") act.pause();
        else if ((s.status === "dead" || s.status === "won") && overRef.current) afterBreak(() => actions.current.start());
        return;
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (s.status === "playing") act.pause();
        else if (s.status === "paused") act.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Leaving the tab or the portal frame pauses the run. */
  useEffect(() => {
    const onHide = () => { if (document.hidden) actions.current.pause(); };
    const onBlur = () => actions.current.pause();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* Touch: a swipe turns as soon as the finger has moved far enough, and chained swipes work without lifting. */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    const o = touch.current;
    if (!o) return;
    const t = e.touches[0];
    const dx = t.clientX - o.x, dy = t.clientY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    pushDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touch.current = { x: t.clientX, y: t.clientY };
  };

  useGameLoop(canvasRef, {
    update(dt) {
      const s = g.current;
      const rm = reduced.current;
      s.time += dt;

      // effects
      for (const p of s.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.98; p.life -= dt; }
      s.particles = s.particles.filter(p => p.life > 0);
      for (const p of s.popups) { p.y -= 46 * dt; p.life -= dt; }
      s.popups = s.popups.filter(p => p.life > 0);
      for (const r of s.rings) r.life -= dt;
      s.rings = s.rings.filter(r => r.life > 0);
      if (s.callout) { s.callout.life -= dt; if (s.callout.life <= 0) s.callout = null; }
      s.shake = Math.max(0, s.shake - dt * 30);
      s.flash = Math.max(0, s.flash - dt * 3);

      // head turns smoothly toward its heading
      const target = ANGLE[s.dir];
      let diff = target - s.headAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.headAngle = rm ? target : s.headAngle + diff * Math.min(1, dt * 22);

      if (s.status === "dead") {
        s.deathT += dt;
        const total = s.snake.length + 1;
        const gap = Math.min(0.045, 0.7 / total);
        if (!rm && s.deathT > 0.3) {
          const target = Math.min(total, Math.floor((s.deathT - 0.3) / gap));
          while (s.popped < target) {
            const p = s.snake[Math.min(s.popped, s.snake.length - 1)];
            const cx = (p.x + 0.5) * CELL, cy = (p.y + 0.5) * CELL;
            burst(s, cx, cy, 4, [mix(C.head, C.tail, s.popped / total), C.juice[3]], 0.6);
            s.popped++;
          }
        }
        const showAt = rm ? 0.45 : Math.min(1.5, 0.3 + total * gap + 0.25);
        if (!s.overShown && s.deathT >= showAt) { s.overShown = true; setUiOver(true); }
        return;
      }
      if (s.status === "won") {
        s.deathT += dt;
        if (!s.overShown && s.deathT >= 0.8) { s.overShown = true; setUiOver(true); }
        return;
      }
      if (s.status === "paused") return;

      // swallowed berries travel down the body
      if (s.bulges.length) {
        s.bulges = s.bulges.map(b => b + (dt / s.interval) * 1.6).filter(b => b < s.snake.length + 1);
      }

      if (s.grace > 0) { s.grace -= dt; return; }
      s.accum += dt;
      if (s.accum < s.interval) return;
      s.accum -= s.interval;
      if (s.accum > s.interval) s.accum = 0;

      if (s.demo) demoSteer(s);
      const res = step(s);

      if (res === "die") {
        if (s.demo) { g.current = newState(s.cols, s.rows, s.difficulty, true); return; }
        s.status = "dead";
        s.accum = s.interval;
        s.deathT = 0;
        s.shake = rm ? 0 : 14;
        s.flash = rm ? 0 : 0.6;
        playRef.current("die");
        const isBest = recordRef.current(s.score);
        setUiNewBest(isBest);
        setUiStatus("dead");
        if (isBest) window.setTimeout(() => playRef.current("win"), 650);
        return;
      }

      if (res === "eat") {
        const fx = (s.food.x + 0.5) * CELL, fy = (s.food.y + 0.5) * CELL;
        if (s.demo) {
          if (s.snake.length > DEMO_MAX_LEN) { s.snake.pop(); s.grew = false; }
        } else {
          s.score += 1;
          setUiScore(s.score);
          setScorePop(v => v + 1);
          playRef.current("eat");
          s.popups.push({ x: fx, y: fy - CELL * 0.4, text: "+1", life: 0.8 });
          s.interval = intervalFor(s.score, s.difficulty);
        }
        if (!rm) {
          burst(s, fx, fy, s.demo ? 8 : 18, C.juice);
          s.rings.push({ x: fx, y: fy, life: 0.45 });
          s.bulges.push(0);
        }
        const next = randomFood(s);
        if (!next) {
          // Every cell is snake: the board is cleared.
          s.status = "won";
          s.deathT = 0;
          recordRef.current(s.score);
          playRef.current("win");
          setUiNewBest(s.score > s.prevBest);
          setUiStatus("won");
          return;
        }
        s.food = next;
        s.foodBorn = s.time;
      }
    },

    draw(ctx, w, h) {
      const s = g.current;
      const key = `${s.cols}x${s.rows}`;
      if (!field.current || field.current.key !== key) field.current = { key, canvas: buildField(s.cols, s.rows) };
      // Before the first step and after the run ends the snake rests on whole cells.
      const t = s.steps === 0 || s.status === "dead" || s.status === "won" ? 1 : clamp(s.accum / s.interval, 0, 1);

      ctx.save();
      ctx.fillStyle = C.stage;
      ctx.fillRect(0, 0, w, h);
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      ctx.drawImage(field.current.canvas, 0, 0, s.cols * CELL, s.rows * CELL);

      // berry
      if (s.status !== "won") {
        const age = s.time - s.foodBorn;
        const sc = reduced.current ? 1 : age < 0.35 ? Math.max(0, easeOutBack(age / 0.35)) : 1;
        const breathe = reduced.current ? 1 : 1 + Math.sin(s.time * 5) * 0.04;
        drawBerry(ctx, (s.food.x + 0.5) * CELL, (s.food.y + 0.5) * CELL, sc * breathe);
      }

      drawSnake(ctx, s, t);

      // rings
      for (const r of s.rings) {
        const f = 1 - r.life / 0.45;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - f) * 0.8})`;
        ctx.lineWidth = 4 * (1 - f) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, CELL * (0.3 + f * 1.3), 0, Math.PI * 2); ctx.stroke();
      }
      // particles
      for (const p of s.particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // score popups
      for (const p of s.popups) {
        const f = 1 - p.life / 0.8;
        const size = 22 * (f < 0.15 ? 0.6 + (f / 0.15) * 0.5 : 1.1 - (f - 0.15) * 0.15);
        drawText(ctx, p.text, p.x, p.y, size, C.popupFill, C.popupStroke, Math.min(1, p.life / 0.3));
      }
      ctx.restore();

      // death flash
      if (s.flash > 0) {
        ctx.fillStyle = `rgba(${C.flash},${s.flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
  }, true);

  /* Board size in CSS pixels: whole cells, as large as the area allows. */
  const cellPx = area.w && area.h ? Math.min(area.w / dims.cols, area.h / dims.rows) : 0;
  const boardW = Math.floor(cellPx * dims.cols);
  const boardH = Math.floor(cellPx * dims.rows);
  const W = dims.cols * CELL;
  const H = dims.rows * CELL;

  const shownBest = Math.max(best ?? 0, uiStatus === "playing" || uiStatus === "paused" ? uiScore : 0);
  const inRound = uiStatus === "playing" || uiStatus === "paused";
  const ended = (uiStatus === "dead" || uiStatus === "won") && uiOver;
  const bigButton = "flex items-center justify-center gap-2.5 h-14 px-10 rounded-xl text-xl font-bold shadow-md hover:brightness-110 active:translate-y-0.5 transition-[filter,transform]";
  const buttonStyle = { background: C.button, color: C.buttonText };

  return (
    <div
      className="w-full h-full flex flex-col touch-none select-none font-game"
      style={{ background: C.stage }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { touch.current = null; }}
    >
      {/* Score readout on the stage, kept clear on the right where portal builds put their mute and fullscreen buttons. */}
      <div className="shrink-0 h-14 flex items-center gap-2 pl-3 pr-28 text-white">
        {inRound && (
          <button
            type="button"
            onClick={() => (uiStatus === "paused" ? resume() : pause())}
            aria-label={uiStatus === "paused" ? m.resume : m.pause}
            title={uiStatus === "paused" ? m.resume : m.pause}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-white hover:brightness-125 transition-[filter]"
            style={{ background: C.panel }}
          >
            {uiStatus === "paused" ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
          </button>
        )}
        <div className="h-10 flex items-baseline gap-2 rounded-xl px-3 pt-2" style={{ background: C.panel }} aria-label={m.score}>
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">{m.score}</span>
          <span
            key={scorePop}
            className={`text-xl font-black tabular-nums leading-none ${scorePop ? "motion-safe:animate-slide-up" : ""}`}
          >
            {uiScore}
          </span>
        </div>
        <div className="h-10 flex items-baseline gap-2 rounded-xl px-3 pt-2" style={{ background: C.panel }} aria-label={m.best}>
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">{m.best}</span>
          <span className="text-xl font-black tabular-nums leading-none">{shownBest}</span>
        </div>
      </div>

      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center p-3">
        <div
          className="relative overflow-hidden"
          style={{ width: boardW || undefined, height: boardH || undefined }}
        >
          <GameCanvas ref={canvasRef} width={W} height={H} cssWidth={boardW} cssHeight={boardH} className="block" />

          {/* Menu over the attract-mode board */}
          {uiStatus === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 py-4 text-white animate-fade-in overflow-hidden" style={{ background: C.dim }}>
              <h1 className="text-6xl font-black uppercase tracking-wide drop-shadow-md">{m.title}</h1>

              <button type="button" onClick={start} className={bigButton} style={buttonStyle}>
                <PlayIcon className="w-6 h-6" />
                {m.play}
              </button>

              <div role="radiogroup" aria-label={m.difficulty} className="flex rounded-xl overflow-hidden ring-1 ring-white/50">
                {(Object.keys(DIFF) as Difficulty[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === key}
                    onClick={() => setDifficulty(key)}
                    className={`h-9 px-3 text-sm font-semibold transition-colors ${
                      difficulty === key ? "bg-white text-black" : "bg-black/25 text-white hover:bg-black/40"
                    }`}
                  >
                    {m.levels[key]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/90">
                <span className="flex items-center gap-1.5">
                  <TrophyIcon className="w-4 h-4" />
                  {m.best} <b className="tabular-nums">{best ?? 0}</b>
                </span>
                <span className="flex items-center gap-1.5">
                  {touchUi ? <SwipeIcon className="w-4 h-4" /> : <KeysIcon className="w-6 h-4" />}
                  {touchUi ? m.controlsTouch : m.controlsKeys}
                </span>
              </div>
            </div>
          )}

          {/* Pause */}
          {uiStatus === "paused" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-white animate-fade-in" style={{ background: C.dim }}>
              <p className="text-4xl font-black drop-shadow-md">{m.paused}</p>
              <button type="button" onClick={resume} className={bigButton} style={buttonStyle}>
                <PlayIcon className="w-6 h-6" />
                {m.resume}
              </button>
            </div>
          )}

          {/* Game over */}
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-white animate-fade-in" style={{ background: C.dim }}>
              <div className="w-full max-w-[18rem] flex flex-col items-center gap-4 animate-slide-up">
                <p className="text-4xl font-black uppercase drop-shadow-md text-center">
                  {uiStatus === "won" ? m.cleared : m.gameOver}
                </p>
                <div className="w-full rounded-xl px-6 py-4 flex items-center justify-around" style={{ background: C.stage }}>
                  <span className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-white/80">{m.score}</span>
                    <span className="text-4xl font-black tabular-nums leading-none">
                      <CountUp value={uiScore} reduced={reduced.current} />
                    </span>
                  </span>
                  <span className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-white/80">{m.best}</span>
                    <span className="text-4xl font-black tabular-nums leading-none">{best ?? 0}</span>
                  </span>
                </div>
                {uiNewBest && <p className="text-base font-bold" style={{ color: C.gold }}>{m.newBest}</p>}
                <button type="button" autoFocus onClick={() => afterBreak(start)} className={`${bigButton} w-full`} style={buttonStyle}>
                  <ReplayIcon className="w-6 h-6" />
                  {m.playAgain}
                </button>
                <button
                  type="button"
                  onClick={toMenu}
                  className="h-10 px-6 rounded-xl text-sm font-bold text-white/90 hover:bg-white/15 transition-colors"
                >
                  {m.menu}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
