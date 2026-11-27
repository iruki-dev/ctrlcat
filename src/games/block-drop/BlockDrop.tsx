import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { useBestScore } from "../lib/useBestScore";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { useSound } from "../../components/games/SoundContext";

type Phase = "idle" | "playing" | "paused" | "over" | "won";
type Matrix = number[][];

interface Piece {
  index: number;
  mx: Matrix;
  x: number;
  y: number;
  /* Drawn position and spin, eased toward the real ones every frame. */
  vx: number;
  vy: number;
  spin: number;
}

/* ---------- Board rules ---------- */

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const BW = COLS * CELL;
const BH = ROWS * CELL;

const WIN_LINES = 100;
const LINES_PER_LEVEL = 10;
const MAX_LEVEL = 10;
const DAS = 0.16;
const ARR = 0.045;
const LOCK_DELAY = 0.45;
const LOCK_RESETS = 15;
const CLEAR_TIME = 0.34;
const NEXT_COUNT = 3;
/* Kept from the game's earlier name so saved best scores carry over. */
const BEST_KEY = "ctrlcat-tetris-best";

/* ---------- Layout (logical canvas units) ---------- */

const RIM = 8;
const PANEL_W = 118;
const PANEL_GAP = 14;
const LAND_W = PANEL_W * 2 + PANEL_GAP * 2 + BW + RIM * 2;
const LAND_H = BH + RIM * 2;
const HUD_H = 74;
const PORT_W = BW + RIM * 2;
const PORT_H = HUD_H + 10 + BH + RIM * 2;
const TOP_RESERVE = 56;
const PAD_ROW_H = 72;
const SIDE_PAD_W = 120;
const MAX_SCALE = 1.5;

/* ---------- Colors. Canvas and inline styles cannot read Tailwind tokens. ---------- */

/* The usual falling-block piece colors, in PIECES order: I, J, L, O, S, T, Z. */
const GEMS = ["#31c7ef", "#3d63d8", "#ef7921", "#f7d308", "#42b642", "#ad4d9c", "#ef2029"];
const GEM_DEAD = "#5b5f68";
const INK = "#ffffff";
const INK_DIM = "#a9adb6";
const INK_FAINT = "#7c818b";
const NAVY = "#111317";
const GOLD = "#f7d308";
const GOLD_DEEP = "#d9b500";
const GOLD_SHADOW = "#8a7300";
const ROSE = "#ef2029";
const WELL_TOP = "#0b0c0f";
const WELL_BOTTOM = "#0b0c0f";
const RIM_TOP = "#4a4e57";
const RIM_BOTTOM = "#33363d";
const PANEL_FILL = "#0b0c0f";
const PANEL_LINE = "#3a3d45";
const CABINET = "linear-gradient(180deg, #23262c 0%, #17191d 100%)";
const GLASS = "#1d2025";
const GLASS_LINE = "#3a3d45";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/* Seven four-square shapes, each in a square box so turning is a plain matrix turn. */
const PIECES: Matrix[] = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
];

const CLEAR_POINTS = [0, 100, 300, 500, 800];
const COMBO_POINTS = 50;

/* ---------- Pure helpers ---------- */

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function shuffledBag(): number[] {
  const bag = [0, 1, 2, 3, 4, 5, 6];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

function rotateCW(mx: Matrix): Matrix {
  return mx[0].map((_, i) => mx.map((row) => row[i]).reverse());
}

function rotateCCW(mx: Matrix): Matrix {
  const n = mx.length;
  return mx[0].map((_, i) => mx.map((row) => row[n - 1 - i]));
}

function collides(board: number[][], mx: Matrix, px: number, py: number): boolean {
  for (let r = 0; r < mx.length; r++) {
    for (let c = 0; c < mx[r].length; c++) {
      if (!mx[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function dropInterval(level: number): number {
  return Math.max(0.1, 0.9 - (level - 1) * 0.08);
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Mixes a hex color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const [r, g, b] = hexRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px}px`;
}

/* A square block with a bevel, drawn once per color and size and then stamped. */
function makeGem(color: string, px: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = px;
  cv.height = px;
  const g = cv.getContext("2d");
  if (!g) return cv;
  const pad = Math.max(1, Math.round(px * 0.03));
  const s = px - pad * 2;
  const bev = Math.max(2, Math.round(s * 0.14));

  g.fillStyle = color;
  g.fillRect(pad, pad, s, s);
  /* Lit top and left edge. */
  g.beginPath();
  g.moveTo(pad, pad);
  g.lineTo(pad + s, pad);
  g.lineTo(pad + s - bev, pad + bev);
  g.lineTo(pad + bev, pad + bev);
  g.lineTo(pad + bev, pad + s - bev);
  g.lineTo(pad, pad + s);
  g.closePath();
  g.fillStyle = shade(color, 0.4);
  g.fill();
  /* Shaded bottom and right edge. */
  g.beginPath();
  g.moveTo(pad + s, pad);
  g.lineTo(pad + s, pad + s);
  g.lineTo(pad, pad + s);
  g.lineTo(pad + bev, pad + s - bev);
  g.lineTo(pad + s - bev, pad + s - bev);
  g.lineTo(pad + s - bev, pad + bev);
  g.closePath();
  g.fillStyle = shade(color, -0.35);
  g.fill();
  /* Face, a touch lighter at the top. */
  const face = g.createLinearGradient(0, pad + bev, 0, pad + s - bev);
  face.addColorStop(0, shade(color, 0.12));
  face.addColorStop(1, color);
  g.fillStyle = face;
  g.fillRect(pad + bev, pad + bev, s - bev * 2, s - bev * 2);
  return cv;
}

/* Inline style for one block in the DOM (title screen). */
function gemStyle(color: string, size: number): CSSProperties {
  const bev = Math.max(2, Math.round(size * 0.14));
  return {
    width: size,
    height: size,
    background: color,
    boxShadow: `inset ${bev}px ${bev}px 0 ${shade(color, 0.4)}, inset -${bev}px -${bev}px 0 ${shade(color, -0.35)}`,
  };
}

/* ---------- Runtime state ---------- */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  rot: number;
  vr: number;
}

interface Callout {
  text: string;
  color: string;
  size: number;
  t: number;
  life: number;
  slot: number;
}

interface Trail {
  x: number;
  y0: number;
  y1: number;
  color: string;
  t: number;
}

interface GameState {
  board: number[][];
  piece: Piece | null;
  bag: number[];
  queue: number[];
  dropTimer: number;
  lockTimer: number;
  lockResets: number;
  lowestY: number;
  moveDir: number;
  dasTimer: number;
  arrTimer: number;
  clearing: number[] | null;
  clearTimer: number;
  score: number;
  shownScore: number;
  lines: number;
  level: number;
  combo: number;
  rowOffset: number[];
  particles: Particle[];
  callouts: Callout[];
  trails: Trail[];
  flash: { cells: [number, number][]; t: number } | null;
  shake: number;
  kick: number;
  levelPulse: number;
  deathT: number;
  time: number;
}

function createState(): GameState {
  let bag = shuffledBag();
  const queue: number[] = [];
  while (queue.length < NEXT_COUNT) {
    if (bag.length === 0) bag = shuffledBag();
    queue.push(bag.pop() as number);
  }
  return {
    board: emptyBoard(),
    piece: null,
    bag,
    queue,
    dropTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    lowestY: 0,
    moveDir: 0,
    dasTimer: 0,
    arrTimer: 0,
    clearing: null,
    clearTimer: 0,
    score: 0,
    shownScore: 0,
    lines: 0,
    level: 1,
    combo: 0,
    rowOffset: new Array(ROWS).fill(0),
    particles: [],
    callouts: [],
    trails: [],
    flash: null,
    shake: 0,
    kick: 0,
    levelPulse: 0,
    deathT: 0,
    time: 0,
  };
}

const messages = {
  en: {
    ...common.en,
    title: "Block Drop",
    play: "Play",
    keyMove: "Move",
    keyTurn: "Turn",
    keySoft: "Soft drop",
    keyDrop: "Hard drop",
    keyPause: "Pause",
    keySpace: "SPACE",
    touchHint: "Swipe to move, swipe up to turn, swipe down to drop",
    scoreCaps: "SCORE",
    bestCaps: "BEST",
    levelCaps: "LEVEL",
    linesCaps: "LINES",
    next: "NEXT",
    double: "DOUBLE",
    triple: "TRIPLE",
    quad: "QUAD",
    combo: (n: number) => `COMBO ${n}`,
    levelUp: (n: number) => `LEVEL ${n}`,
    gameOver: "GAME OVER",
    wonTitle: "100 LINES!",
    newBest: "NEW BEST",
    rowsCleared: "Lines",
    menu: "Menu",
    paused: "PAUSED",
    moveLeft: "Move left",
    rotate: "Turn",
    moveRight: "Move right",
    moveDown: "Move down one row",
    hardDrop: "Drop to the bottom",
  },
  ko: {
    ...common.ko,
    title: "블록 드롭",
    play: "시작",
    keyMove: "이동",
    keyTurn: "회전",
    keySoft: "빨리 내리기",
    keyDrop: "바로 내리기",
    keyPause: "일시 정지",
    keySpace: "Space",
    touchHint: "좌우로 밀어 이동, 위로 밀어 회전, 아래로 밀어 내리기",
    scoreCaps: "점수",
    bestCaps: "최고",
    levelCaps: "레벨",
    linesCaps: "줄",
    next: "다음",
    double: "더블",
    triple: "트리플",
    quad: "쿼드",
    combo: (n: number) => `콤보 ${n}`,
    levelUp: (n: number) => `레벨 ${n}`,
    gameOver: "게임 오버",
    wonTitle: "100줄 달성!",
    newBest: "최고 기록",
    rowsCleared: "지운 줄",
    menu: "메뉴",
    paused: "일시 정지",
    moveLeft: "왼쪽으로 이동",
    rotate: "회전",
    moveRight: "오른쪽으로 이동",
    moveDown: "한 칸 내리기",
    hardDrop: "맨 아래로 내리기",
  },
};

/* ---------- Small DOM pieces ---------- */

function Svg({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICON = {
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  rotate: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4v5h-5" />
    </>
  ),
  drop: (
    <>
      <path d="M6 5l6 6 6-6" />
      <path d="M6 12l6 6 6-6" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),
};

function PadButton({
  label,
  onPress,
  repeat = false,
  primary = false,
  size = 58,
  children,
}: {
  label: string;
  onPress: () => void;
  repeat?: boolean;
  primary?: boolean;
  size?: number;
  children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const interval = useRef<number | null>(null);
  const cb = useRef(onPress);
  cb.current = onPress;
  const [down, setDown] = useState(false);

  const stop = () => {
    setDown(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (interval.current !== null) window.clearInterval(interval.current);
    timer.current = null;
    interval.current = null;
  };
  useEffect(() => stop, []);

  const style: CSSProperties = primary
    ? {
        width: size,
        height: size,
        color: "#2a2300",
        background: down ? GOLD_DEEP : GOLD,
        boxShadow: down ? `0 1px 0 ${GOLD_SHADOW}` : `0 4px 0 ${GOLD_SHADOW}`,
        transform: down ? "translateY(3px)" : undefined,
      }
    : {
        width: size,
        height: size,
        color: INK,
        background: down ? "#3a3d45" : "#2e3138",
        border: `1px solid ${GLASS_LINE}`,
        boxShadow: down ? "0 1px 0 #0b0c0f" : "0 4px 0 #0b0c0f",
        transform: down ? "translateY(3px)" : undefined,
      };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-full flex items-center justify-center select-none transition-transform duration-75"
      style={{ ...style, touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        setDown(true);
        cb.current();
        if (repeat) {
          timer.current = window.setTimeout(() => {
            interval.current = window.setInterval(() => cb.current(), 55);
          }, 170);
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function BigButton({ onClick, children, autoFocus }: { onClick: () => void; children: ReactNode; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="relative inline-flex items-center justify-center gap-2.5 rounded-md px-10 h-14 text-xl font-extrabold select-none transition-all duration-100 hover:brightness-105 active:translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
      style={{
        color: "#2a2300",
        background: GOLD,
        boxShadow: `0 5px 0 ${GOLD_SHADOW}`,
        fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}

function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md text-xs font-bold"
      style={{
        color: INK,
        background: "#2e3138",
        border: `1px solid ${GLASS_LINE}`,
        boxShadow: "0 2px 0 #0b0c0f",
      }}
    >
      {children}
    </span>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/* ---------- Component ---------- */

export default function BlockDrop() {
  const m = useMessages(messages);
  const { play } = useSound();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createState());
  const phaseRef = useRef<Phase>("idle");
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const { best, record } = useBestScore(BEST_KEY);
  const bestAtStart = useRef<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [shownFinal, setShownFinal] = useState(0);

  const [box, setBox] = useState({ w: 800, h: 600, portal: false, touch: false });

  const { held, consume } = useKeys();
  usePhaseEvents(phase, { paused: ["paused"], lost: ["over"], score });

  const playRef = useRef(play);
  playRef.current = play;
  const sfx = useCallback((type: Parameters<typeof play>[0]) => playRef.current(type), []);

  /* ---------- Fit to the space we have ---------- */

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const portal = !!el.closest(".portal-stage");
      const parentH = el.parentElement?.clientHeight ?? window.innerHeight;
      const h = portal ? parentH : Math.max(520, Math.min(window.innerHeight - 16, 900));
      const touch = !!window.matchMedia?.("(pointer: coarse)").matches;
      setBox((prev) =>
        prev.w === el.clientWidth && prev.h === h && prev.portal === portal && prev.touch === touch
          ? prev
          : { w: el.clientWidth, h, portal, touch },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* In a portal frame the mute and fullscreen buttons sit at the top right, so keep the board clear of them. */
  const sideW = Math.max(box.touch ? SIDE_PAD_W * 2 : 0, box.portal ? 200 : 0);
  const scaleLand = Math.min((box.w - 32 - sideW) / LAND_W, (box.h - 24) / LAND_H, MAX_SCALE);
  const scalePort = Math.min((box.w - 24) / PORT_W, (box.h - TOP_RESERVE - PAD_ROW_H - 20) / PORT_H, MAX_SCALE);
  const portrait = scalePort > scaleLand * 1.08;
  const scale = Math.max(0.4, portrait ? scalePort : scaleLand);
  const lw = portrait ? PORT_W : LAND_W;
  const lh = portrait ? PORT_H : LAND_H;
  const cssW = Math.round(lw * scale);
  const cssH = Math.round(lh * scale);
  const layoutRef = useRef({ portrait, scale, lw, lh, touch: box.touch });
  layoutRef.current = { portrait, scale, lw, lh, touch: box.touch };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
  }, [cssW, cssH, phase]);

  /* ---------- Phase plumbing ---------- */

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const saveBest = useCallback(() => {
    record(stateRef.current.score);
  }, [record]);

  const callout = useCallback((text: string, color: string, size: number, slot: number) => {
    const s = stateRef.current;
    s.callouts = s.callouts.filter((c) => c.slot !== slot);
    s.callouts.push({ text, color, size, t: 0, life: 1.1, slot });
  }, []);

  const burst = useCallback((x: number, y: number, color: string, count: number, power: number) => {
    if (reducedRef.current) return;
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.35 + Math.random() * 0.8);
      s.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - power * 0.5,
        life: 0,
        max: 0.5 + Math.random() * 0.6,
        color,
        size: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
      });
    }
    if (s.particles.length > 600) s.particles.splice(0, s.particles.length - 600);
  }, []);

  const takeNext = useCallback(() => {
    const s = stateRef.current;
    if (s.bag.length === 0) s.bag = shuffledBag();
    const next = s.queue.shift() as number;
    s.queue.push(s.bag.pop() as number);
    return next;
  }, []);

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const index = takeNext();
    const shape = PIECES[index];
    const x = Math.floor((COLS - shape.length) / 2);
    const piece: Piece = { index, mx: shape, x, y: 0, vx: x, vy: -1.2, spin: 0 };
    if (reducedRef.current) piece.vy = 0;
    if (collides(s.board, piece.mx, piece.x, piece.y)) {
      s.piece = null;
      s.deathT = 0;
      s.shake = 10;
      saveBest();
      sfx("die");
      goTo("over");
      return;
    }
    s.piece = piece;
    s.dropTimer = 0;
    s.lockTimer = 0;
    s.lockResets = 0;
    s.lowestY = 0;
  }, [goTo, saveBest, sfx, takeNext]);

  const resolveClear = useCallback(() => {
    const s = stateRef.current;
    const rows = s.clearing ?? [];
    const kept = s.board.filter((_, r) => !rows.includes(r));
    /* Each surviving row remembers how far it fell, so it can slide down instead of jumping. */
    const offsets = new Array(ROWS).fill(0);
    let newRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (rows.includes(r)) continue;
      offsets[newRow] = reducedRef.current ? 0 : -(newRow - r) * CELL;
      newRow--;
    }
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
    s.board = kept;
    s.rowOffset = offsets;

    const prevLevel = s.level;
    s.lines += rows.length;
    const gained = CLEAR_POINTS[rows.length] * s.level + (s.combo > 1 ? COMBO_POINTS * (s.combo - 1) * s.level : 0);
    s.score += gained;
    s.level = Math.min(MAX_LEVEL, Math.floor(s.lines / LINES_PER_LEVEL) + 1);
    s.clearing = null;
    s.clearTimer = 0;
    setScore(s.score);
    setLines(s.lines);
    setLevel(s.level);
    if (s.level > prevLevel) {
      s.levelPulse = 1;
      callout(m.levelUp(s.level), GEMS[(s.level - 1) % GEMS.length], 34, 0);
      sfx("win");
    }
    if (s.lines >= WIN_LINES) {
      saveBest();
      s.deathT = 0;
      if (!reducedRef.current) {
        for (let i = 0; i < 8; i++) burst(RIM + Math.random() * BW, RIM + Math.random() * BH * 0.6, GEMS[i % GEMS.length], 18, 260);
      }
      sfx("win");
      goTo("won");
      return;
    }
    spawn();
  }, [burst, callout, goTo, m, saveBest, sfx, spawn]);

  const lockPiece = useCallback(
    (hard: boolean) => {
      const s = stateRef.current;
      const p = s.piece;
      if (!p) return;
      const cells: [number, number][] = [];
      for (let r = 0; r < p.mx.length; r++) {
        for (let c = 0; c < p.mx[r].length; c++) {
          if (!p.mx[r][c]) continue;
          const y = p.y + r;
          const x = p.x + c;
          if (y >= 0) {
            s.board[y][x] = p.index + 1;
            cells.push([x, y]);
          }
        }
      }
      s.piece = null;
      s.flash = { cells, t: 0 };
      if (hard && !reducedRef.current) s.kick = 5;

      const full: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        if (s.board[r].every((v) => v !== 0)) full.push(r);
      }
      if (full.length > 0) {
        s.combo += 1;
        s.clearing = full;
        s.clearTimer = 0;
        for (const r of full) {
          for (let c = 0; c < COLS; c++) {
            const v = s.board[r][c];
            burst(c * CELL + CELL / 2, r * CELL + CELL / 2, GEMS[v - 1], full.length >= 4 ? 5 : 3, 200 + full.length * 40);
          }
        }
        if (!reducedRef.current) s.shake = Math.max(s.shake, full.length >= 4 ? 12 : full.length === 3 ? 7 : full.length === 2 ? 3 : 0);
        const gained = CLEAR_POINTS[full.length] * s.level + (s.combo > 1 ? COMBO_POINTS * (s.combo - 1) * s.level : 0);
        if (full.length === 2) callout(m.double, GEMS[0], 30, 1);
        else if (full.length === 3) callout(m.triple, GEMS[5], 32, 1);
        else if (full.length >= 4) callout(m.quad, GOLD, 34, 1);
        callout(`+${fmt(gained)}`, GOLD, 22, 2);
        if (s.combo > 1) callout(m.combo(s.combo), GEMS[6], 24, 3);
        sfx(full.length >= 4 ? "win" : "correct");
        return;
      }
      s.combo = 0;
      sfx("place");
      spawn();
    },
    [burst, callout, m, sfx, spawn],
  );

  /* A successful move or turn on the floor buys a little more time, up to a limit. */
  const onShifted = useCallback(() => {
    const s = stateRef.current;
    if (s.lockTimer > 0 && s.lockResets < LOCK_RESETS) {
      s.lockTimer = 0;
      s.lockResets += 1;
    }
  }, []);

  const move = useCallback(
    (dx: number) => {
      const s = stateRef.current;
      if (phaseRef.current !== "playing" || !s.piece || s.clearing) return;
      if (!collides(s.board, s.piece.mx, s.piece.x + dx, s.piece.y)) {
        s.piece.x += dx;
        onShifted();
      }
    },
    [onShifted],
  );

  const rotate = useCallback(
    (dir: number) => {
      const s = stateRef.current;
      const p = s.piece;
      if (phaseRef.current !== "playing" || !p || s.clearing) return;
      const turned = dir > 0 ? rotateCW(p.mx) : rotateCCW(p.mx);
      const apply = (dx: number, dy: number) => {
        p.mx = turned;
        p.x += dx;
        p.y += dy;
        if (!reducedRef.current && p.index !== 3) p.spin = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        onShifted();
      };
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!collides(s.board, turned, p.x + dx, p.y)) {
          apply(dx, 0);
          return;
        }
      }
      /* Last resort: lift the piece one row, which frees turns against the floor. */
      for (const dx of [0, -1, 1]) {
        if (!collides(s.board, turned, p.x + dx, p.y - 1)) {
          apply(dx, -1);
          return;
        }
      }
    },
    [onShifted],
  );

  /* Moves the piece down one row. Returns false when it landed and locked. */
  const stepDown = useCallback(
    (soft: boolean) => {
      const s = stateRef.current;
      const p = s.piece;
      if (phaseRef.current !== "playing" || !p || s.clearing) return false;
      if (collides(s.board, p.mx, p.x, p.y + 1)) {
        lockPiece(false);
        return false;
      }
      p.y += 1;
      if (p.y > s.lowestY) {
        s.lowestY = p.y;
        s.lockResets = 0;
      }
      if (soft) {
        s.score += 1;
        setScore(s.score);
      }
      return true;
    },
    [lockPiece],
  );

  const hardDrop = useCallback(() => {
    const s = stateRef.current;
    const p = s.piece;
    if (phaseRef.current !== "playing" || !p || s.clearing) return;
    const startY = p.y;
    let dist = 0;
    while (!collides(s.board, p.mx, p.x, p.y + 1)) {
      p.y += 1;
      dist += 1;
    }
    if (dist > 0 && !reducedRef.current) {
      for (let r = 0; r < p.mx.length; r++) {
        for (let c = 0; c < p.mx[r].length; c++) {
          if (!p.mx[r][c]) continue;
          /* Only the top square of each column leaves a streak. */
          if (r > 0 && p.mx[r - 1][c]) continue;
          s.trails.push({ x: p.x + c, y0: startY + r, y1: p.y + r, color: GEMS[p.index], t: 0 });
        }
      }
    }
    s.score += dist * 2;
    setScore(s.score);
    lockPiece(true);
  }, [lockPiece]);

  const drainKeys = useCallback(() => {
    for (const k of [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "x", "X", "z", "Z", "p", "P", "Escape", "Enter"]) consume(k);
  }, [consume]);

  const startGame = useCallback(() => {
    stateRef.current = createState();
    bestAtStart.current = best;
    drainKeys();
    setScore(0);
    setLines(0);
    setLevel(1);
    setShowResult(false);
    goTo("playing");
    spawn();
  }, [best, drainKeys, goTo, spawn]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") goTo("paused");
    else if (phaseRef.current === "paused") {
      drainKeys();
      goTo("playing");
    }
  }, [drainKeys, goTo]);

  const quit = useCallback(() => {
    saveBest();
    goTo("idle");
  }, [goTo, saveBest]);

  const playAgain = useCallback(() => afterBreak(startGame), [startGame]);

  /* Menu and result keys. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phase === "idle" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        startGame();
      } else if ((phase === "over" || phase === "won") && showResult && e.key === "Enter") {
        e.preventDefault();
        playAgain();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, showResult, startGame, playAgain]);

  /* Pause when the tab or the portal frame goes into the background. */
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && phaseRef.current === "playing") goTo("paused");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [goTo]);

  /* Let the board settle before the result card slides in, then count the score up. */
  useEffect(() => {
    if (phase !== "over" && phase !== "won") {
      setShowResult(false);
      return;
    }
    const delay = reduced ? 150 : phase === "over" ? 950 : 700;
    const id = window.setTimeout(() => setShowResult(true), delay);
    return () => window.clearTimeout(id);
  }, [phase, reduced]);

  useEffect(() => {
    if (!showResult) return;
    if (reduced) {
      setShownFinal(score);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = clamp01((now - t0) / 900);
      setShownFinal(Math.round(score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showResult, score, reduced]);

  useSwipe((dir) => {
    if (phaseRef.current !== "playing") return;
    if (dir === "left") move(-1);
    else if (dir === "right") move(1);
    else if (dir === "up") rotate(1);
    else hardDrop();
  });

  /* ---------- Loop ---------- */

  const sprite = (colorIdx: number, size: number, pxs: number) => {
    const px = Math.max(4, Math.round(size * pxs));
    const key = `${colorIdx}:${px}`;
    let sp = spriteCache.current.get(key);
    if (!sp) {
      if (spriteCache.current.size > 120) spriteCache.current.clear();
      sp = makeGem(colorIdx < 0 ? GEM_DEAD : GEMS[colorIdx], px);
      spriteCache.current.set(key, sp);
    }
    return sp;
  };

  useGameLoop(
    canvasRef,
    {
      update(dt) {
        const s = stateRef.current;
        const ph = phaseRef.current;

        if (consume("p") || consume("P") || consume("Escape")) togglePause();
        if (ph === "paused") return;

        s.time += dt;
        /* Effects keep running on the result screens. */
        for (const pt of s.particles) {
          pt.life += dt;
          pt.vy += 620 * dt;
          pt.vx *= 1 - 1.5 * dt;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt;
        }
        s.particles = s.particles.filter((pt) => pt.life < pt.max);
        for (const c of s.callouts) c.t += dt;
        s.callouts = s.callouts.filter((c) => c.t < c.life);
        for (const tr of s.trails) tr.t += dt;
        s.trails = s.trails.filter((tr) => tr.t < 0.22);
        if (s.flash) {
          s.flash.t += dt;
          if (s.flash.t > 0.18) s.flash = null;
        }
        s.shake *= Math.pow(0.0015, dt);
        if (s.shake < 0.2) s.shake = 0;
        s.kick *= Math.pow(0.0005, dt);
        if (s.kick < 0.1) s.kick = 0;
        s.levelPulse = Math.max(0, s.levelPulse - dt * 0.9);
        for (let r = 0; r < ROWS; r++) {
          if (s.rowOffset[r] < 0) s.rowOffset[r] = Math.min(0, s.rowOffset[r] + dt * 900);
        }
        s.shownScore += (s.score - s.shownScore) * Math.min(1, dt * 9);
        if (Math.abs(s.score - s.shownScore) < 1) s.shownScore = s.score;

        if (ph === "over" || ph === "won") {
          s.deathT += dt;
          return;
        }
        if (ph !== "playing") return;

        if (s.clearing) {
          s.clearTimer += dt;
          if (s.clearTimer >= CLEAR_TIME) resolveClear();
          return;
        }
        const p = s.piece;
        if (!p) return;

        /* Ease the drawn piece toward its real cell. */
        const ease = reducedRef.current ? 1 : Math.min(1, dt * 28);
        p.vx += (p.x - p.vx) * ease;
        p.vy += (p.y - p.vy) * Math.min(1, ease * 1.2);
        p.spin *= reducedRef.current ? 0 : Math.pow(0.000001, dt);
        if (Math.abs(p.spin) < 0.01) p.spin = 0;

        /* Every fresh key press moves once, even a tap shorter than one frame.
           Holding the key then repeats after a short delay. */
        let tapped = 0;
        if (consume("ArrowLeft")) tapped = -1;
        if (consume("ArrowRight")) tapped = 1;
        if (tapped !== 0) {
          move(tapped);
          s.moveDir = tapped;
          s.dasTimer = 0;
          s.arrTimer = 0;
        } else {
          const left = held.current.has("ArrowLeft");
          const right = held.current.has("ArrowRight");
          const dir = left && !right ? -1 : right && !left ? 1 : 0;
          if (dir !== s.moveDir) {
            s.moveDir = dir;
            s.dasTimer = 0;
            s.arrTimer = 0;
          } else if (dir !== 0) {
            s.dasTimer += dt;
            if (s.dasTimer >= DAS) {
              s.arrTimer += dt;
              while (s.arrTimer >= ARR) {
                s.arrTimer -= ARR;
                move(dir);
              }
            }
          }
        }

        if (consume("ArrowUp") || consume("x") || consume("X")) rotate(1);
        if (consume("z") || consume("Z")) rotate(-1);
        if (consume(" ")) {
          hardDrop();
          return;
        }
        if (!s.piece) return;

        const soft = held.current.has("ArrowDown");
        if (collides(s.board, p.mx, p.x, p.y + 1)) {
          /* Resting on something: a short grace period before it locks. */
          s.dropTimer = 0;
          s.lockTimer += dt;
          if (s.lockTimer >= (soft ? LOCK_DELAY * 0.4 : LOCK_DELAY)) lockPiece(false);
          return;
        }
        s.lockTimer = 0;
        const interval = soft ? Math.max(0.025, dropInterval(s.level) / 10) : dropInterval(s.level);
        s.dropTimer += dt;
        while (s.dropTimer >= interval) {
          s.dropTimer -= interval;
          if (collides(s.board, p.mx, p.x, p.y + 1)) {
            s.dropTimer = 0;
            break;
          }
          stepDown(soft);
        }
      },

      draw(ctx) {
        const s = stateRef.current;
        const L = layoutRef.current;
        const dpr = window.devicePixelRatio || 1;
        const pxs = dpr * L.scale;
        const ph = phaseRef.current;
        ctx.setTransform(pxs, 0, 0, pxs, 0, 0);
        ctx.clearRect(0, 0, L.lw, L.lh);
        ctx.textBaseline = "alphabetic";

        const bx = L.portrait ? RIM : PANEL_W + PANEL_GAP + RIM;
        const by = L.portrait ? HUD_H + 10 + RIM : RIM;

        let topFilled = ROWS;
        for (let r = 0; r < ROWS; r++) {
          if (s.board[r].some((v) => v)) {
            topFilled = r;
            break;
          }
        }
        const danger = ph === "playing" && topFilled < 5;

        /* ----- HUD ----- */
        const panel = (x: number, y: number, w: number, h: number) => {
          roundRect(ctx, x, y, w, h, 4);
          ctx.fillStyle = PANEL_FILL;
          ctx.fill();
          ctx.strokeStyle = PANEL_LINE;
          ctx.lineWidth = 1;
          ctx.stroke();
        };
        const label = (text: string, x: number, y: number, align: CanvasTextAlign = "left") => {
          ctx.textAlign = align;
          ctx.fillStyle = INK_DIM;
          ctx.font = `800 10px ${FONT}`;
          setSpacing(ctx, 1.6);
          ctx.fillText(text, x, y);
          setSpacing(ctx, 0);
        };
        const value = (text: string, x: number, y: number, size: number, color: string, maxW: number, align: CanvasTextAlign = "left") => {
          ctx.textAlign = align;
          let fs = size;
          ctx.font = `900 ${fs}px ${FONT}`;
          while (fs > 10 && ctx.measureText(text).width > maxW) {
            fs -= 1;
            ctx.font = `900 ${fs}px ${FONT}`;
          }
          ctx.fillStyle = color;
          ctx.fillText(text, x, y);
        };
        const bar = (x: number, y: number, w: number, k: number, color: string) => {
          ctx.fillStyle = "#2a2d33";
          ctx.fillRect(x, y, w, 4);
          if (k > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, Math.max(4, w * k), 4);
          }
        };
        const mini = (idx: number, cx: number, cy: number, cell: number) => {
          const nm = PIECES[idx];
          let minC = 9;
          let maxC = -1;
          let minR = 9;
          let maxR = -1;
          for (let r = 0; r < nm.length; r++) {
            for (let c = 0; c < nm[r].length; c++) {
              if (!nm[r][c]) continue;
              minC = Math.min(minC, c);
              maxC = Math.max(maxC, c);
              minR = Math.min(minR, r);
              maxR = Math.max(maxR, r);
            }
          }
          const ox = cx - ((maxC - minC + 1) * cell) / 2;
          const oy = cy - ((maxR - minR + 1) * cell) / 2;
          const sp = sprite(idx, cell, pxs);
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              if (nm[r][c]) ctx.drawImage(sp, ox + (c - minC) * cell, oy + (r - minR) * cell, cell, cell);
            }
          }
        };
        const bestNow = Math.max(bestAtStart.current ?? 0, s.score);
        const levelK = s.level >= MAX_LEVEL ? 1 : (s.lines % LINES_PER_LEVEL) / LINES_PER_LEVEL;

        if (L.portrait) {
          panel(0, 0, 104, HUD_H);
          label(m.scoreCaps, 12, 18);
          value(fmt(s.shownScore), 12, 44, 24, INK, 84);
          ctx.textAlign = "left";
          ctx.font = `700 10px ${FONT}`;
          ctx.fillStyle = INK_FAINT;
          ctx.fillText(`${m.bestCaps} ${fmt(bestNow)}`, 12, 62);

          panel(110, 0, 66, HUD_H);
          label(m.levelCaps, 143, 18, "center");
          value(String(s.level), 143, 46, 24, INK, 54, "center");
          bar(118, 58, 50, levelK, GEMS[0]);

          panel(182, 0, PORT_W - 182, HUD_H);
          label(m.next, 182 + (PORT_W - 182) / 2, 18, "center");
          mini(s.queue[0], 182 + (PORT_W - 182) / 2, 46, 13);
        } else {
          const rx = LAND_W - PANEL_W;
          panel(0, 0, PANEL_W, 82);
          label(m.scoreCaps, 14, 24);
          value(fmt(s.shownScore), 14, 60, 28, INK, PANEL_W - 28);

          panel(0, 92, PANEL_W, 60);
          label(m.bestCaps, 14, 114);
          value(fmt(bestNow), 14, 140, 18, INK, PANEL_W - 28);

          panel(0, 162, PANEL_W, 88);
          label(m.levelCaps, 14, 184);
          value(String(s.level), 14, 222, 32, INK, PANEL_W - 28);
          bar(14, 234, PANEL_W - 28, levelK, GEMS[0]);

          if (!L.touch) {
            const rowsHint: [string, string][] = [
              ["← →", m.keyMove],
              ["↑", m.keyTurn],
              ["↓", m.keySoft],
              [m.keySpace, m.keyDrop],
              ["P", m.keyPause],
            ];
            let hy = LAND_H - rowsHint.length * 26 - 6;
            for (const [k, txt] of rowsHint) {
              ctx.font = `800 10px ${FONT}`;
              const kw = Math.max(24, ctx.measureText(k).width + 14);
              roundRect(ctx, 2, hy, kw, 20, 3);
              ctx.fillStyle = "#2e3138";
              ctx.fill();
              ctx.strokeStyle = PANEL_LINE;
              ctx.stroke();
              ctx.fillStyle = INK;
              ctx.textAlign = "center";
              ctx.fillText(k, 2 + kw / 2, hy + 14);
              ctx.textAlign = "left";
              ctx.fillStyle = INK_FAINT;
              ctx.font = `600 10px ${FONT}`;
              ctx.fillText(txt, kw + 10, hy + 14, PANEL_W - kw - 10);
              hy += 26;
            }
          }

          panel(rx, 0, PANEL_W, 212);
          label(m.next, rx + 14, 24);
          mini(s.queue[0], rx + PANEL_W / 2, 74, 20);
          ctx.globalAlpha = 0.75;
          mini(s.queue[1], rx + PANEL_W / 2, 136, 14);
          ctx.globalAlpha = 0.5;
          mini(s.queue[2], rx + PANEL_W / 2, 182, 14);
          ctx.globalAlpha = 1;

          panel(rx, 222, PANEL_W, 82);
          label(m.linesCaps, rx + 14, 246);
          value(String(s.lines), rx + 14, 280, 28, INK, 56);
          ctx.font = `800 12px ${FONT}`;
          ctx.textAlign = "right";
          ctx.fillStyle = INK_FAINT;
          ctx.fillText(`/ ${WIN_LINES}`, rx + PANEL_W - 14, 280);
          bar(rx + 14, 292, PANEL_W - 28, Math.min(1, s.lines / WIN_LINES), GOLD);

          if (s.combo > 1 && ph === "playing") {
            panel(rx, 314, PANEL_W, 50);
            value(m.combo(s.combo), rx + PANEL_W / 2, 346, 18, GOLD, PANEL_W - 20, "center");
          }
        }

        /* ----- Board ----- */
        ctx.save();
        if (s.shake > 0 && !reducedRef.current) {
          ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
        }
        ctx.translate(0, s.kick);

        /* Plain gray frame; it turns red while the stack is near the top. */
        roundRect(ctx, bx - RIM, by - RIM, BW + RIM * 2, BH + RIM * 2, 6);
        const rim = ctx.createLinearGradient(0, by - RIM, 0, by + BH + RIM);
        rim.addColorStop(0, RIM_TOP);
        rim.addColorStop(1, RIM_BOTTOM);
        ctx.fillStyle = rim;
        ctx.fill();
        if (danger) {
          roundRect(ctx, bx - RIM + 1, by - RIM + 1, BW + RIM * 2 - 2, BH + RIM * 2 - 2, 6);
          ctx.strokeStyle = alpha(ROSE, 0.55 + 0.3 * Math.sin(s.time * 8));
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, BW, BH);
        ctx.clip();
        ctx.fillStyle = WELL_TOP;
        ctx.fillRect(bx, by, BW, BH);
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        for (let c = 1; c < COLS; c++) ctx.fillRect(bx + c * CELL, by, 1, BH);
        for (let r = 1; r < ROWS; r++) ctx.fillRect(bx, by + r * CELL, BW, 1);
        if (danger) {
          const dg = ctx.createLinearGradient(0, by, 0, by + CELL * 6);
          dg.addColorStop(0, alpha(ROSE, 0.18 + 0.1 * Math.sin(s.time * 8)));
          dg.addColorStop(1, alpha(ROSE, 0));
          ctx.fillStyle = dg;
          ctx.fillRect(bx, by, BW, CELL * 6);
        }

        /* Settled squares. On game over they turn to slate from the bottom up. */
        const deadFrom = ph === "over" ? ROWS - s.deathT * 34 : ROWS + 1;
        const clearing = s.clearing;
        const clearK = clearing ? clamp01(s.clearTimer / CLEAR_TIME) : 0;
        for (let r = 0; r < ROWS; r++) {
          const isClearing = clearing?.includes(r);
          const oy = s.rowOffset[r];
          for (let c = 0; c < COLS; c++) {
            const v = s.board[r][c];
            if (!v) continue;
            const x = bx + c * CELL;
            const y = by + r * CELL + oy;
            if (isClearing) {
              const d = Math.abs(c - 4.5) / 5;
              const k = clamp01((clearK - 0.2 - d * 0.35) / 0.4);
              const sz = CELL * (1 - k);
              if (sz > 0.5) ctx.drawImage(sprite(v - 1, CELL, pxs), x + (CELL - sz) / 2, y + (CELL - sz) / 2, sz, sz);
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, clearK * 3) * (1 - k)})`;
              ctx.fillRect(x + (CELL - sz) / 2, y + (CELL - sz) / 2, sz, sz);
            } else {
              ctx.drawImage(sprite(r >= deadFrom ? -1 : v - 1, CELL, pxs), x, y, CELL, CELL);
            }
          }
        }

        if (clearing) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (const r of clearing) {
            const h = CELL * (1 + clearK * 1.4);
            const g = ctx.createLinearGradient(0, by + r * CELL + CELL / 2 - h / 2, 0, by + r * CELL + CELL / 2 + h / 2);
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(0.5, `rgba(255,255,255,${0.7 * (1 - clearK)})`);
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = g;
            ctx.fillRect(bx, by + r * CELL + CELL / 2 - h / 2, BW, h);
          }
          ctx.restore();
        }

        /* Lock flash. */
        if (s.flash) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - s.flash.t / 0.18)})`;
          for (const [x, y] of s.flash.cells) {
            ctx.fillRect(bx + x * CELL + 1, by + y * CELL + 1, CELL - 2, CELL - 2);
          }
        }

        /* Hard-drop streaks. */
        if (s.trails.length) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (const tr of s.trails) {
            const k = 1 - tr.t / 0.22;
            const top = by + tr.y0 * CELL;
            const bottom = by + tr.y1 * CELL;
            const g = ctx.createLinearGradient(0, top, 0, bottom);
            g.addColorStop(0, alpha(tr.color, 0));
            g.addColorStop(1, alpha(tr.color, 0.55 * k));
            ctx.fillStyle = g;
            ctx.fillRect(bx + tr.x * CELL + 3, top, CELL - 6, bottom - top);
          }
          ctx.restore();
        }

        const p = s.piece;
        if (p && (ph === "playing" || ph === "paused")) {
          /* Ghost: where the piece lands if dropped now. */
          let gy = p.y;
          while (!collides(s.board, p.mx, p.x, gy + 1)) gy += 1;
          const col = GEMS[p.index];
          for (let r = 0; r < p.mx.length; r++) {
            for (let c = 0; c < p.mx[r].length; c++) {
              if (!p.mx[r][c] || gy + r < 0) continue;
              ctx.fillStyle = alpha(col, 0.15);
              ctx.fillRect(bx + (p.x + c) * CELL + 1.5, by + (gy + r) * CELL + 1.5, CELL - 3, CELL - 3);
              ctx.strokeStyle = alpha(col, 0.6);
              ctx.lineWidth = 1.5;
              ctx.strokeRect(bx + (p.x + c) * CELL + 1.5, by + (gy + r) * CELL + 1.5, CELL - 3, CELL - 3);
            }
          }

          /* Active piece with a soft glow, drawn at its eased position and spin. */
          const n = p.mx.length;
          const cx = bx + (p.vx + n / 2) * CELL;
          const cy = by + (p.vy + n / 2) * CELL;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(p.spin);
          const sp = sprite(p.index, CELL, pxs);
          const lockK = s.lockTimer > 0 ? 0.5 + 0.5 * Math.sin(s.time * 30) : 0;
          for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
              if (!p.mx[r][c]) continue;
              const x = (c - n / 2) * CELL;
              const y = (r - n / 2) * CELL;
              ctx.drawImage(sp, x, y, CELL, CELL);
              if (lockK > 0) {
                ctx.fillStyle = `rgba(255,255,255,${0.12 * lockK})`;
                ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
              }
            }
          }
          ctx.restore();
        }

        if (ph === "over" || ph === "won" || ph === "paused") {
          const k = ph === "paused" ? 1 : clamp01(s.deathT / 0.9);
          ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * k})`;
          ctx.fillRect(bx, by, BW, BH);
        }
        ctx.restore();

        /* Particles, glowing. */
        if (s.particles.length) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (const pt of s.particles) {
            const k = 1 - pt.life / pt.max;
            ctx.globalAlpha = k;
            ctx.fillStyle = pt.color;
            ctx.save();
            ctx.translate(bx + pt.x, by + pt.y);
            ctx.rotate(pt.rot);
            ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
            ctx.restore();
          }
          ctx.restore();
        }

        /* Callouts pop in over the middle of the well. */
        for (const c of s.callouts) {
          const appear = reducedRef.current ? 1 : easeOutBack(clamp01(c.t / 0.22));
          const fade = clamp01((c.life - c.t) / 0.3);
          const rise = reducedRef.current ? 0 : -c.t * 18;
          const slotY = [BH * 0.3, BH * 0.42, BH * 0.52, BH * 0.6][c.slot] ?? BH * 0.4;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(bx + BW / 2, by + slotY + rise);
          ctx.scale(0.4 + 0.6 * appear, 0.4 + 0.6 * appear);
          ctx.textAlign = "center";
          ctx.font = `900 ${c.size}px ${FONT}`;
          setSpacing(ctx, 1);
          let fs = c.size;
          while (fs > 12 && ctx.measureText(c.text).width > BW - 16) {
            fs -= 1;
            ctx.font = `900 ${fs}px ${FONT}`;
          }
          ctx.lineJoin = "round";
          ctx.lineWidth = 6;
          ctx.strokeStyle = NAVY;
          ctx.strokeText(c.text, 0, 0);
          ctx.fillStyle = c.color;
          ctx.fillText(c.text, 0, 0);
          setSpacing(ctx, 0);
          ctx.restore();
        }
      },
    },
    phase !== "idle",
  );

  /* ---------- Menu entrance animation ---------- */

  const titleRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "idle" || reduced) return;
    const anims: Animation[] = [];
    const pieces = titleRef.current?.querySelectorAll<HTMLElement>("[data-drop]") ?? [];
    pieces.forEach((el, i) => {
      anims.push(
        el.animate(
          [
            { transform: "translateY(-120px)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1, offset: 0.8 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          { duration: 420, delay: 60 + i * 80, easing: "cubic-bezier(.5,0,.9,.6)", fill: "backwards" },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [phase, reduced]);

  useEffect(() => {
    if (!showResult || reduced || !resultRef.current) return;
    const a = resultRef.current.animate(
      [
        { transform: "translateY(24px)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 260, easing: "ease-out" },
    );
    return () => a.cancel();
  }, [showResult, reduced]);

  /* ---------- Render ---------- */

  const rootStyle: CSSProperties = {
    height: box.h,
    background: CABINET,
    color: INK,
    fontFamily: FONT,
    touchAction: phase === "playing" ? "none" : undefined,
  };
  const rootClass = `relative w-full overflow-hidden select-none ${box.portal ? "" : "rounded-xl"}`;

  if (phase === "idle") {
    const blk = Math.max(10, Math.min(18, (box.w - 48) / 26));
    const titleSize = Math.max(40, Math.min(76, box.w / 7));
    /* The seven pieces in a row, as they fall in the game. */
    const row = [0, 5, 3, 4, 6, 1, 2];
    return (
      <div ref={rootRef} className={rootClass} style={rootStyle}>
        <div className="relative h-full flex flex-col items-center justify-center gap-7 px-4 text-center">
          <div ref={titleRef} className="flex flex-col items-center gap-5">
            <div className="flex items-end justify-center" style={{ gap: blk * 0.8 }} aria-hidden="true">
              {row.map((idx) => {
                const mx = PIECES[idx].filter((r) => r.some((v) => v));
                const cols = mx[0].map((_, c) => c).filter((c) => mx.some((r) => r[c]));
                return (
                  <div key={idx} data-drop className="grid" style={{ gridTemplateColumns: `repeat(${cols.length}, ${blk}px)` }}>
                    {mx.flatMap((r, ri) =>
                      cols.map((c) =>
                        r[c] ? <div key={`${ri}-${c}`} style={gemStyle(GEMS[idx], blk)} /> : <div key={`${ri}-${c}`} style={{ width: blk, height: blk }} />,
                      ),
                    )}
                  </div>
                );
              })}
            </div>
            <h1 className="font-black leading-none uppercase" style={{ fontSize: titleSize, letterSpacing: "0.02em", color: INK }}>
              {m.title}
            </h1>
          </div>

          <BigButton onClick={startGame} autoFocus>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
            </svg>
            {m.play}
          </BigButton>

          {best !== null && (
            <p className="text-sm font-bold tracking-wide" style={{ color: INK_DIM }}>
              {m.bestCaps} <span style={{ color: INK }}>{fmt(best)}</span>
            </p>
          )}

          {box.touch ? (
            <p className="text-sm font-medium max-w-xs" style={{ color: INK_FAINT }}>
              {m.touchHint}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold" style={{ color: INK_DIM }}>
              <span className="inline-flex items-center gap-1.5">
                <KeyCap>{"←"}</KeyCap>
                <KeyCap>{"→"}</KeyCap>
                {m.keyMove}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyCap>{"↑"}</KeyCap>
                {m.keyTurn}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyCap>{"↓"}</KeyCap>
                {m.keySoft}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyCap>{m.keySpace}</KeyCap>
                {m.keyDrop}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyCap>P</KeyCap>
                {m.keyPause}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ended = phase === "over" || phase === "won";
  const isNewBest = ended && score > 0 && score > (bestAtStart.current ?? 0);
  const padSize = portrait ? Math.min(60, Math.floor((box.w - 24 - 4 * 10) / 5)) : 56;

  const leftPad = (
    <div className="flex flex-col items-center gap-3" style={{ width: SIDE_PAD_W }}>
      <div className="flex gap-3">
        <PadButton label={m.moveLeft} onPress={() => move(-1)} repeat size={padSize}>
          <Svg>{ICON.left}</Svg>
        </PadButton>
        <PadButton label={m.moveRight} onPress={() => move(1)} repeat size={padSize}>
          <Svg>{ICON.right}</Svg>
        </PadButton>
      </div>
      <PadButton label={m.moveDown} onPress={() => stepDown(true)} repeat size={padSize}>
        <Svg>{ICON.down}</Svg>
      </PadButton>
    </div>
  );
  const rightPad = (
    <div className="flex flex-col items-center gap-3" style={{ width: SIDE_PAD_W }}>
      <PadButton label={m.rotate} onPress={() => rotate(1)} size={padSize + 8}>
        <Svg size={30}>{ICON.rotate}</Svg>
      </PadButton>
      <PadButton label={m.hardDrop} onPress={hardDrop} primary size={padSize + 8}>
        <Svg size={30}>{ICON.drop}</Svg>
      </PadButton>
    </div>
  );
  const bottomPad = (
    <div className="flex items-center justify-center gap-2.5 w-full" style={{ height: PAD_ROW_H }}>
      <PadButton label={m.moveLeft} onPress={() => move(-1)} repeat size={padSize}>
        <Svg>{ICON.left}</Svg>
      </PadButton>
      <PadButton label={m.moveRight} onPress={() => move(1)} repeat size={padSize}>
        <Svg>{ICON.right}</Svg>
      </PadButton>
      <PadButton label={m.moveDown} onPress={() => stepDown(true)} repeat size={padSize}>
        <Svg>{ICON.down}</Svg>
      </PadButton>
      <PadButton label={m.rotate} onPress={() => rotate(1)} size={padSize}>
        <Svg>{ICON.rotate}</Svg>
      </PadButton>
      <PadButton label={m.hardDrop} onPress={hardDrop} primary size={padSize}>
        <Svg>{ICON.drop}</Svg>
      </PadButton>
    </div>
  );

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle}>
      <div
        className={
          portrait
            ? "h-full flex flex-col items-center justify-start"
            : "h-full flex flex-row items-center justify-center gap-2"
        }
      >
        {portrait ? <div style={{ height: TOP_RESERVE - 4, flexShrink: 0 }} /> : box.touch ? leftPad : null}
        <canvas
          ref={canvasRef}
          style={{ width: cssW, height: cssH, flexShrink: 0 }}
          className="block"
          aria-label={`${m.scoreCaps} ${score}, ${m.levelCaps} ${level}, ${m.linesCaps} ${lines}`}
          role="img"
        />
        {portrait ? <div className="mt-2">{bottomPad}</div> : box.touch ? rightPad : null}
      </div>

      {phase === "playing" && (
        <button
          type="button"
          onClick={togglePause}
          aria-label={m.pause}
          title={m.pause}
          className="absolute left-3 top-3 w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:brightness-125"
          style={{ background: GLASS, border: `1px solid ${GLASS_LINE}`, color: INK }}
        >
          <Svg size={20}>{ICON.pause}</Svg>
        </button>
      )}

      {phase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div
            className="flex flex-col items-center gap-6 rounded-lg px-10 py-8 max-w-sm w-full"
            style={{ background: GLASS, border: `1px solid ${GLASS_LINE}` }}
          >
            <h2 className="text-4xl font-black tracking-wide" style={{ color: INK }}>
              {m.paused}
            </h2>
            <BigButton onClick={togglePause} autoFocus>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
              </svg>
              {m.resume}
            </BigButton>
            <button
              type="button"
              onClick={quit}
              className="text-sm font-bold tracking-wide px-5 h-10 rounded-md transition-colors hover:bg-white/10"
              style={{ color: INK_DIM }}
            >
              {m.quit}
            </button>
          </div>
        </div>
      )}

      {ended && showResult && (
        <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div
            ref={resultRef}
            className="flex flex-col items-center gap-5 rounded-lg px-6 sm:px-10 py-8 max-w-sm w-full text-center"
            style={{ background: GLASS, border: `1px solid ${GLASS_LINE}` }}
          >
            <h2 className="text-4xl font-black tracking-wide leading-none" style={{ color: phase === "won" ? GOLD : INK }}>
              {phase === "won" ? m.wonTitle : m.gameOver}
            </h2>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-extrabold tracking-widest" style={{ color: INK_DIM }}>
                {m.scoreCaps}
              </span>
              <span className="text-5xl font-black tabular-nums" style={{ color: INK }}>
                {fmt(shownFinal)}
              </span>
              {isNewBest && (
                <span
                  className="mt-1 inline-flex items-center rounded px-2.5 h-6 text-xs font-black tracking-wider"
                  style={{ color: NAVY, background: GOLD }}
                >
                  {m.newBest}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 w-full">
              {[
                [m.rowsCleared, String(lines)],
                [m.level, String(level)],
                [m.best, fmt(Math.max(best ?? 0, score))],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col items-center justify-center rounded py-2"
                  style={{ background: PANEL_FILL, border: `1px solid ${PANEL_LINE}` }}
                >
                  <span className="text-[11px] font-bold" style={{ color: INK_DIM }}>
                    {k}
                  </span>
                  <span className="text-lg font-black" style={{ color: INK }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <BigButton onClick={playAgain} autoFocus>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
                <path d="M19.5 4v5h-5" />
              </svg>
              {m.playAgain}
            </BigButton>
            <button
              type="button"
              onClick={quit}
              className="text-sm font-bold tracking-wide px-5 h-9 rounded-md transition-colors hover:bg-white/10"
              style={{ color: INK_DIM }}
            >
              {m.menu}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
