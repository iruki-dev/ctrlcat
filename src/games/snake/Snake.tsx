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
const POINTS_PER_TIER = 5;

/* "Night Garden" palette for canvas and SVG drawing (canvas constants are the allowed hex exception). */
const C = {
  stage: "#0a1420",
  fieldA: "#12283a",
  fieldB: "#163049",
  edge: "#0b1a28",
  tuft: "#2b6a5c",
  tuftTip: "#49947a",
  petal: "#f6e7b0",
  petalPink: "#f7a3bf",
  pebble: "#1f3b54",
  vignette: "rgba(3,9,16,0.6)",
  head: [210, 248, 74] as RGB,
  tail: [32, 186, 152] as RGB,
  deadBody: [120, 132, 140] as RGB,
  outline: "#082820",
  shine: "rgba(255,255,230,0.38)",
  eye: "#ffffff",
  pupil: "#0a1420",
  tongue: "#ff5c7a",
  blush: "rgba(255,110,140,0.55)",
  mouth: "#3a0d1c",
  berryLight: "#ff9fba",
  berry: "#ff2f66",
  berryDark: "#a20f3e",
  leaf: "#8de04e",
  leafDark: "#3d8f2b",
  stem: "#5b3a1e",
  seed: "rgba(255,240,205,0.85)",
  glow: "255,70,120",
  shadow: "rgba(0,0,0,0.35)",
  juice: ["#ff2f66", "#ff6f96", "#ffd166", "#d2f84a", "#ffffff"],
  popupFill: "#ffffff",
  popupStroke: "#082820",
  calloutFill: "#ffe066",
  calloutStroke: "#3a1a00",
  flash: "255,255,255",
  titleTop: "#efff8a",
  titleBottom: "#93e02c",
  titleShadow: "#041510",
};

const FONT = "Roboto, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ---------------------------------------------------------------- messages */

const messages = {
  en: {
    ...common.en,
    title: "Snake",
    subtitle: "Night Garden",
    tagline: "Eat berries. Grow long. Never bite your tail.",
    play: "Play",
    levels: { easy: "Easy", normal: "Normal", hard: "Hard", insane: "Insane" } as Record<Difficulty, string>,
    difficulty: "Difficulty",
    controlsKeys: "Arrows or WASD to steer",
    controlsTouch: "Swipe anywhere to steer",
    gameOver: "Game over",
    cleared: "Board cleared",
    newBest: "New best!",
    menu: "Menu",
    paused: "Paused",
    speed: "Speed",
    speedUp: "Speed up!",
    go: "Go!",
  },
  ko: {
    ...common.ko,
    title: "스네이크",
    subtitle: "밤의 정원",
    tagline: "열매를 먹고 길어지세요. 꼬리는 물면 안 돼요.",
    play: "플레이",
    levels: { easy: "쉬움", normal: "보통", hard: "어려움", insane: "극한" } as Record<Difficulty, string>,
    difficulty: "난이도",
    controlsKeys: "방향키나 WASD로 조종",
    controlsTouch: "화면을 밀어서 조종",
    gameOver: "게임 오버",
    cleared: "판을 다 채웠어요",
    newBest: "최고 기록!",
    menu: "메뉴",
    paused: "일시 정지",
    speed: "속도",
    speedUp: "속도 업!",
    go: "출발!",
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
  ctx.fillStyle = C.fieldA;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = C.fieldB;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if ((x + y) % 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
  // Seeded decorations so the same board always looks the same.
  let seed = cols * 977 + rows * 131;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const r = rnd();
    const ox = x * CELL + 6 + rnd() * (CELL - 12);
    const oy = y * CELL + 8 + rnd() * (CELL - 14);
    if (r < 0.1) {
      // grass tuft
      ctx.lineCap = "round";
      for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = i === 0 ? C.tuftTip : C.tuft;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + i * 3, oy + 5);
        ctx.quadraticCurveTo(ox + i * 4, oy, ox + i * 6, oy - 4 - (i === 0 ? 3 : 0));
        ctx.stroke();
      }
    } else if (r < 0.135) {
      // tiny flower
      ctx.fillStyle = rnd() < 0.5 ? C.petal : C.petalPink;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(ox + Math.cos(a) * 2.6, oy + Math.sin(a) * 2.6, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = C.calloutFill;
      ctx.beginPath(); ctx.arc(ox, oy, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (r < 0.165) {
      // pebble
      ctx.fillStyle = C.pebble;
      ctx.beginPath(); ctx.ellipse(ox, oy, 3.5, 2.5, rnd() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Vignette
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, C.vignette);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Inner rim
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, w, h);
  return cv;
}

/* ---------------------------------------------------------------- drawing */

function drawBerry(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, time: number) {
  const r = CELL * 0.34 * scale;
  if (r <= 0.5) return;
  // glow
  const pulse = 0.55 + Math.sin(time * 4) * 0.15;
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.6);
  g.addColorStop(0, `rgba(${C.glow},${0.45 * pulse})`);
  g.addColorStop(1, `rgba(${C.glow},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
  // ground shadow
  const bob = Math.sin(time * 3.2) * 2;
  ctx.fillStyle = C.shadow;
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.95, r * (0.85 - bob * 0.04), r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  const by = y - 2 + bob;
  // body
  const bg = ctx.createRadialGradient(x - r * 0.35, by - r * 0.4, r * 0.1, x, by, r * 1.1);
  bg.addColorStop(0, C.berryLight);
  bg.addColorStop(0.45, C.berry);
  bg.addColorStop(1, C.berryDark);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(x, by, r, 0, Math.PI * 2); ctx.fill();
  // seeds
  ctx.fillStyle = C.seed;
  for (const [sx, sy] of [[0.35, 0.2], [-0.25, 0.4], [0.05, 0.55], [0.45, -0.2]]) {
    ctx.beginPath(); ctx.ellipse(x + sx * r, by + sy * r, r * 0.07, r * 0.11, 0.4, 0, Math.PI * 2); ctx.fill();
  }
  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, by - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  // stem + leaf
  ctx.strokeStyle = C.stem; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, by - r * 0.85); ctx.quadraticCurveTo(x + 1, by - r * 1.25, x + 3, by - r * 1.4); ctx.stroke();
  const sway = Math.sin(time * 2.4) * 0.18;
  ctx.save();
  ctx.translate(x + 2, by - r * 1.2);
  ctx.rotate(-0.5 + sway);
  ctx.fillStyle = C.leaf;
  ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.5, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.leafDark; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.85, 0); ctx.stroke();
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
  ctx.fillStyle = C.outline;
  ctx.beginPath(); ctx.ellipse(CELL * 0.06, 0, rx + 2.5, ry + 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flashing ? C.eye : color;
  ctx.beginPath(); ctx.ellipse(CELL * 0.06, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  // top shine
  ctx.fillStyle = C.shine;
  ctx.beginPath(); ctx.ellipse(-CELL * 0.02, -ry * 0.45, rx * 0.6, ry * 0.22, 0, 0, Math.PI * 2); ctx.fill();

  // Food direction in head space, for the pupils and the open mouth.
  const fx = (s.food.x + 0.5) * CELL - x, fy = (s.food.y + 0.5) * CELL - y;
  const lx = fx * Math.cos(-a) - fy * Math.sin(-a);
  const ly = fx * Math.sin(-a) + fy * Math.cos(-a);
  const dist = Math.hypot(lx, ly) || 1;
  const near = !s.demo && !dead && lx > 0 && dist < CELL * 2.3 && Math.abs(ly) < CELL * 0.9;

  // tongue flick
  const tongueOn = !dead && !near && (s.time % 2.2) < 0.22;
  if (tongueOn) {
    const len = CELL * 0.42 * Math.sin(((s.time % 2.2) / 0.22) * Math.PI);
    ctx.strokeStyle = C.tongue; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rx, 0); ctx.lineTo(rx + len, 0);
    ctx.lineTo(rx + len + 4, -3); ctx.moveTo(rx + len, 0); ctx.lineTo(rx + len + 4, 3);
    ctx.stroke();
  }
  if (near) {
    ctx.fillStyle = C.mouth;
    ctx.beginPath(); ctx.ellipse(rx * 0.72, 0, rx * 0.26, ry * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (!near && !dead) {
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(rx * 0.35, 0, ry * 0.42, -0.9, 0.9); ctx.stroke();
  }
  // cheeks
  ctx.fillStyle = C.blush;
  ctx.beginPath(); ctx.ellipse(CELL * 0.36, -ry * 0.62, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(CELL * 0.36, ry * 0.62, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();

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
    ctx.fillStyle = C.outline;
    ctx.beginPath(); ctx.ellipse(ex, ey, er + 1.5, (blink ? er * 0.2 : er) + 1.5, 0, 0, Math.PI * 2); ctx.fill();
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
    let w = CELL * (0.86 - 0.4 * Math.pow(f, 1.3));
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
  // soft ground shadow
  ctx.strokeStyle = C.shadow;
  for (let i = total - 2; i >= start; i--) {
    ctx.lineWidth = widthAt(i) + 2;
    ctx.beginPath(); ctx.moveTo(pts[i].x + 2, pts[i].y + 4); ctx.lineTo(pts[i + 1].x + 2, pts[i + 1].y + 4); ctx.stroke();
  }
  // outline
  ctx.strokeStyle = C.outline;
  for (let i = total - 2; i >= start; i--) {
    ctx.lineWidth = widthAt(i) + 5;
    ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
  }
  // body: a darker underside, then the lit top, so it reads as a round tube
  for (let i = total - 2; i >= start; i--) {
    ctx.strokeStyle = flashing ? C.eye : colorAt(i, 0.72);
    ctx.lineWidth = widthAt(i);
    ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
  }
  if (!flashing) {
    for (let i = total - 2; i >= start; i--) {
      const w = widthAt(i);
      ctx.strokeStyle = colorAt(i);
      ctx.lineWidth = w * 0.74;
      ctx.beginPath(); ctx.moveTo(pts[i].x - w * 0.05, pts[i].y - w * 0.1); ctx.lineTo(pts[i + 1].x - w * 0.05, pts[i + 1].y - w * 0.1); ctx.stroke();
    }
  }
  // spots that stay with the same body cell as it slides
  if (!flashing) {
    for (let i = Math.max(2, start + 1); i < n - 1; i++) {
      if ((s.steps - i) % 2 !== 0) continue;
      const w = widthAt(i);
      ctx.fillStyle = colorAt(i, 0.58);
      ctx.beginPath(); ctx.ellipse(pts[i].x - w * 0.04, pts[i].y - w * 0.08, w * 0.3, w * 0.22, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // shine along the top
  ctx.strokeStyle = C.shine;
  for (let i = total - 2; i >= start; i--) {
    const w = widthAt(i);
    ctx.lineWidth = w * 0.14;
    ctx.beginPath(); ctx.moveTo(pts[i].x - w * 0.14, pts[i].y - w * 0.24); ctx.lineTo(pts[i + 1].x - w * 0.14, pts[i + 1].y - w * 0.24); ctx.stroke();
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

function TitleArt({ title }: { title: string }) {
  const text = title.toUpperCase();
  return (
    <svg viewBox="0 0 360 150" className="w-full max-w-[320px] h-auto drop-shadow-xl" role="img" aria-label={title}>
      <defs>
        <linearGradient id="snake-title-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.titleTop} />
          <stop offset="1" stopColor={C.titleBottom} />
        </linearGradient>
        <linearGradient id="snake-title-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={`rgb(${C.tail.join(",")})`} />
          <stop offset="1" stopColor={`rgb(${C.head.join(",")})`} />
        </linearGradient>
      </defs>
      <path d="M34 122 C 80 146, 120 98, 172 118 S 258 142, 292 114" stroke={C.outline} strokeWidth="21" fill="none" strokeLinecap="round" />
      <path d="M34 122 C 80 146, 120 98, 172 118 S 258 142, 292 114" stroke="url(#snake-title-body)" strokeWidth="15" fill="none" strokeLinecap="round" />
      <path d="M40 120 C 82 140, 120 94, 172 114 S 256 138, 288 110" stroke={C.shine} strokeWidth="4" fill="none" strokeLinecap="round" />
      <g transform="translate(300 110) rotate(-24)">
        <path d="M14 0 L24 0 M24 0 L29 -3 M24 0 L29 3" stroke={C.tongue} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <ellipse cx="0" cy="0" rx="17" ry="13" fill={C.outline} />
        <ellipse cx="0" cy="0" rx="14.5" ry="10.5" fill={`rgb(${C.head.join(",")})`} />
        <circle cx="2" cy="-5" r="4.2" fill={C.eye} stroke={C.outline} strokeWidth="1.4" />
        <circle cx="2" cy="5" r="4.2" fill={C.eye} stroke={C.outline} strokeWidth="1.4" />
        <circle cx="3.6" cy="-5" r="2.2" fill={C.pupil} />
        <circle cx="3.6" cy="5" r="2.2" fill={C.pupil} />
      </g>
      <g transform="translate(336 92)">
        <circle r="10" fill={C.berry} />
        <circle r="10" fill="none" stroke={C.berryDark} strokeWidth="1.5" />
        <ellipse cx="-3.5" cy="-4" rx="2.6" ry="1.6" fill="white" opacity="0.8" />
        <ellipse cx="5" cy="-12" rx="5.5" ry="2.4" fill={C.leaf} transform="rotate(-30 5 -12)" />
      </g>
      <text x="178" y="92" textAnchor="middle" fontSize="78" fontWeight="900" letterSpacing="3" fill={C.titleShadow}
        style={{ fontFamily: FONT }} transform="translate(0 6)">{text}</text>
      <text x="178" y="92" textAnchor="middle" fontSize="78" fontWeight="900" letterSpacing="3"
        fill="url(#snake-title-fill)" stroke={C.outline} strokeWidth="9" strokeLinejoin="round"
        style={{ fontFamily: FONT, paintOrder: "stroke" }}>{text}</text>
    </svg>
  );
}

function BerryIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="14" r="8" fill={C.berry} stroke={C.berryDark} strokeWidth="1.2" />
      <ellipse cx="9" cy="11" rx="2.2" ry="1.4" fill="white" opacity="0.75" />
      <ellipse cx="15" cy="5" rx="4.5" ry="2" fill={C.leaf} transform="rotate(-25 15 5)" />
    </svg>
  );
}

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
const SpeedIcon = ({ className }: { className?: string }) => (
  <Svg className={className}><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" /></Svg>
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
    s.callout = { text: mRef.current.go, life: 0.9 };
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
            burst(s, cx, cy, 4, [mix(C.head, C.tail, s.popped / total), C.juice[4]], 0.6);
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
          // speed tier callout
          const before = intervalFor(s.score - 1, s.difficulty);
          if (s.score % POINTS_PER_TIER === 0 && before > DIFF[s.difficulty].minMs / 1000) {
            s.callout = { text: mRef.current.speedUp, life: 1.1 };
            playRef.current("correct");
          } else if (!s.bestCalled && s.prevBest > 0 && s.score === s.prevBest + 1) {
            s.bestCalled = true;
            s.callout = { text: mRef.current.newBest, life: 1.2 };
          }
          s.interval = intervalFor(s.score, s.difficulty);
        }
        if (!rm) {
          burst(s, fx, fy, s.demo ? 8 : 18, C.juice);
          s.rings.push({ x: fx, y: fy, life: 0.45 });
          s.bulges.push(0);
          if (!s.demo) s.shake = Math.max(s.shake, 3);
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
        const breathe = reduced.current ? 1 : 1 + Math.sin(s.time * 5) * 0.05;
        drawBerry(ctx, (s.food.x + 0.5) * CELL, (s.food.y + 0.5) * CELL, sc * breathe, reduced.current ? 0 : s.time);
      }

      drawSnake(ctx, s, t);

      // rings
      for (const r of s.rings) {
        const f = 1 - r.life / 0.45;
        ctx.strokeStyle = `rgba(255,230,140,${(1 - f) * 0.9})`;
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
      // callout
      if (s.callout && s.status === "playing") {
        const total = s.callout.text === mRef.current.go ? 0.9 : 1.1;
        const f = 1 - s.callout.life / total;
        const pop = reduced.current ? 1 : f < 0.18 ? easeOutBack(f / 0.18) : 1;
        const alpha = f > 0.7 ? (1 - f) / 0.3 : 1;
        const size = Math.min(w / 7, 64) * pop;
        if (size > 2) drawText(ctx, s.callout.text, w / 2, h * 0.38, size, C.calloutFill, C.calloutStroke, alpha);
      }
    },
  }, true);

  /* Board size in CSS pixels: whole cells, as large as the area allows. */
  const cellPx = area.w && area.h ? Math.min(area.w / dims.cols, area.h / dims.rows) : 0;
  const boardW = Math.floor(cellPx * dims.cols);
  const boardH = Math.floor(cellPx * dims.rows);
  const W = dims.cols * CELL;
  const H = dims.rows * CELL;

  const speedMul = (DIFF[difficulty].baseMs / 1000 / intervalFor(uiScore, difficulty)).toFixed(1);
  const shownBest = Math.max(best ?? 0, uiStatus === "playing" || uiStatus === "paused" ? uiScore : 0);
  const inRound = uiStatus === "playing" || uiStatus === "paused";
  const ended = (uiStatus === "dead" || uiStatus === "won") && uiOver;

  const chip = "flex items-center gap-1.5 h-10 rounded-full px-3 bg-game-surface/80 border border-game-border-dim shadow-sm backdrop-blur";

  return (
    <div
      className="w-full h-full flex flex-col touch-none select-none font-game"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { touch.current = null; }}
    >
      {/* HUD row: kept clear on the right where portal builds put their mute and fullscreen buttons. */}
      <div className="shrink-0 h-16 flex items-center gap-2 pl-3 pr-28">
        {inRound ? (
          <>
            <button
              type="button"
              onClick={() => (uiStatus === "paused" ? resume() : pause())}
              disabled={!inRound}
              aria-label={uiStatus === "paused" ? m.resume : m.pause}
              title={uiStatus === "paused" ? m.resume : m.pause}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-game-surface/80 border border-game-border-dim text-game-text-dim hover:text-game-text disabled:opacity-40 transition-colors"
            >
              {uiStatus === "paused" ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
            </button>
            <div className={chip} aria-label={m.score}>
              <BerryIcon className="w-6 h-6 -ml-1" />
              <span
                key={scorePop}
                className={`text-2xl font-black tabular-nums text-game-text leading-none ${scorePop ? "motion-safe:animate-slide-up" : ""}`}
              >
                {uiScore}
              </span>
            </div>
            <div className={`${chip} text-game-text-dim`} aria-label={m.best}>
              <TrophyIcon className="w-4 h-4 text-game-accent" />
              <span className="text-base font-bold tabular-nums leading-none">{shownBest}</span>
            </div>
            <div className={`${chip} text-game-text-dim hidden min-[420px]:flex`} aria-label={m.speed}>
              <SpeedIcon className="w-4 h-4 text-game-secondary" />
              <span className="text-base font-bold tabular-nums leading-none">{speedMul}x</span>
            </div>
          </>
        ) : null}
      </div>

      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center px-3 pb-3">
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/40"
          style={{ width: boardW || undefined, height: boardH || undefined }}
        >
          <GameCanvas ref={canvasRef} width={W} height={H} cssWidth={boardW} cssHeight={boardH} className="block" />

          {/* Menu over the attract-mode board */}
          {uiStatus === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 py-4 bg-gradient-to-b from-black/60 via-black/35 to-black/70 text-white animate-fade-in overflow-hidden">
              <div className="w-full flex flex-col items-center -mb-1">
                <TitleArt title={m.title} />
                <p className="-mt-1 text-xs font-bold uppercase tracking-[0.35em] text-white/75">{m.subtitle}</p>
              </div>
              <p className="text-sm text-white/80 text-center max-w-[22rem] leading-snug">{m.tagline}</p>

              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-game-accent/40 motion-safe:animate-ping" aria-hidden="true" />
                <button
                  type="button"
                  onClick={start}
                  className="relative flex items-center gap-3 h-16 pl-8 pr-10 rounded-full bg-game-accent text-game-on-accent text-2xl font-black shadow-xl shadow-black/40 ring-4 ring-white/15 hover:scale-105 active:scale-95 transition-transform"
                >
                  <PlayIcon className="w-7 h-7" />
                  {m.play}
                </button>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div role="radiogroup" aria-label={m.difficulty} className="flex gap-1 p-1 rounded-full bg-black/40 ring-1 ring-white/10">
                  {(Object.keys(DIFF) as Difficulty[]).map(key => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={difficulty === key}
                      onClick={() => setDifficulty(key)}
                      className={`h-8 px-3 rounded-full text-xs font-bold transition-colors ${
                        difficulty === key ? "bg-white text-black" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {m.levels[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-white/75">
                <span className="flex items-center gap-1.5">
                  <TrophyIcon className="w-4 h-4" />
                  {m.best} <b className="text-white text-sm tabular-nums">{best ?? 0}</b>
                </span>
                <span className="w-px h-4 bg-white/25" aria-hidden="true" />
                <span className="flex items-center gap-1.5">
                  {touchUi ? <SwipeIcon className="w-4 h-4" /> : <KeysIcon className="w-6 h-4" />}
                  {touchUi ? m.controlsTouch : m.controlsKeys}
                </span>
              </div>
            </div>
          )}

          {/* Pause */}
          {uiStatus === "paused" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/55 backdrop-blur-sm text-white animate-fade-in">
              <p className="text-4xl font-black tracking-tight drop-shadow-lg">{m.paused}</p>
              <button
                type="button"
                onClick={resume}
                className="flex items-center gap-3 h-14 pl-7 pr-9 rounded-full bg-game-accent text-game-on-accent text-xl font-black shadow-xl shadow-black/40 hover:scale-105 active:scale-95 transition-transform"
              >
                <PlayIcon className="w-6 h-6" />
                {m.resume}
              </button>
            </div>
          )}

          {/* Game over */}
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] text-white animate-fade-in">
              <div className="w-full max-w-[20rem] flex flex-col items-center gap-4 animate-slide-up">
                <p className="text-4xl sm:text-5xl font-black tracking-tight uppercase drop-shadow-lg text-center">
                  {uiStatus === "won" ? m.cleared : m.gameOver}
                </p>
                <div className="relative w-full rounded-3xl bg-white/10 ring-1 ring-white/15 px-6 pt-5 pb-4 flex flex-col items-center">
                  {uiNewBest && (
                    <span className="absolute -top-3 rounded-full bg-game-secondary text-white text-xs font-black uppercase tracking-wider px-3 py-1 shadow-lg motion-safe:animate-bounce">
                      {m.newBest}
                    </span>
                  )}
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">{m.score}</span>
                  <span className="text-6xl font-black tabular-nums leading-none mt-1 drop-shadow">
                    <CountUp value={uiScore} reduced={reduced.current} />
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 text-sm text-white/75">
                    <TrophyIcon className="w-4 h-4" />
                    {m.best} <b className="text-white tabular-nums">{best ?? 0}</b>
                    <span className="text-white/40 px-1" aria-hidden="true">/</span>
                    {m.levels[difficulty]}
                  </span>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => afterBreak(start)}
                  className="w-full flex items-center justify-center gap-3 h-16 rounded-full bg-game-accent text-game-on-accent text-2xl font-black shadow-xl shadow-black/40 ring-4 ring-white/15 hover:scale-105 active:scale-95 transition-transform"
                >
                  <ReplayIcon className="w-7 h-7" />
                  {m.playAgain}
                </button>
                <button
                  type="button"
                  onClick={toMenu}
                  className="h-10 px-6 rounded-full text-sm font-bold text-white/75 hover:text-white hover:bg-white/10 transition-colors"
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
