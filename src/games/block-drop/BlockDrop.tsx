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
const CLEAR_TIME = 0.36;
const NEXT_COUNT = 3;
/* Kept from the game's earlier name so saved best scores carry over. */
const BEST_KEY = "ctrlcat-tetris-best";

/* ---------- Layout (logical canvas units) ---------- */

const RIM = 6;
const PANEL_W = 118;
const PANEL_GAP = 12;
const LAND_W = PANEL_W * 2 + PANEL_GAP * 2 + BW + RIM * 2;
const LAND_H = BH + RIM * 2;
const HUD_H = 64;
const PORT_W = BW + RIM * 2;
const PORT_H = HUD_H + 8 + BH + RIM * 2;
const TOP_RESERVE = 52;
const PAD_ROW_H = 64;
const SIDE_PAD_W = 120;
const MAX_SCALE = 1.5;

/* ---------- Colors. Canvas and inline styles cannot read Tailwind tokens. ----------
   A plain dark cabinet with a black well and flat, bevelled blocks in the colors players
   already know from block-stacking games. */

const BLOCKS = ["#16c4dc", "#2457d6", "#ee8a12", "#f0cc10", "#2fb84a", "#9b34c8", "#dd2c2c"];
const BLOCK_DEAD = "#6a6a6a";
const CABINET = "#181818";
const WELL = "#000000";
const GRID = "#161616";
const FRAME = "#7a7a7a";
const TEXT = "#ececec";
const TEXT_DIM = "#9c9c9c";
const KEY_BG = "#2c2c2c";
const KEY_LINE = "#555555";
const KEY_TEXT = "#e6e6e6";

const FONT = "Arial, 'Helvetica Neue', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

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

function pad6(n: number): string {
  return String(Math.max(0, Math.round(n))).padStart(6, "0");
}

/* A flat square with a light top-left edge and a dark bottom-right edge, drawn once per color and size. */
function makeBlock(color: string, px: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = px;
  cv.height = px;
  const g = cv.getContext("2d");
  if (!g) return cv;
  const e = Math.max(1, Math.round(px * 0.13));
  g.fillStyle = shade(color, -0.55);
  g.fillRect(0, 0, px, px);
  const inner = px - 1;
  g.fillStyle = shade(color, 0.42);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(inner, 0);
  g.lineTo(inner - e, e);
  g.lineTo(e, e);
  g.lineTo(e, inner - e);
  g.lineTo(0, inner);
  g.closePath();
  g.fill();
  g.fillStyle = shade(color, -0.3);
  g.beginPath();
  g.moveTo(inner, 0);
  g.lineTo(inner, inner);
  g.lineTo(0, inner);
  g.lineTo(e, inner - e);
  g.lineTo(inner - e, inner - e);
  g.lineTo(inner - e, e);
  g.closePath();
  g.fill();
  g.fillStyle = color;
  g.fillRect(e, e, inner - e * 2, inner - e * 2);
  return cv;
}

/* ---------- Runtime state ---------- */

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
  lines: number;
  level: number;
  combo: number;
  deathT: number;
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
    lines: 0,
    level: 1,
    combo: 0,
    deathT: 0,
  };
}

const messages = {
  en: {
    ...common.en,
    title: "Block Drop",
    goal: (n: number) => `The game ends when you clear ${n} lines.`,
    start: "Start",
    keyColumn: "Key",
    actionColumn: "Action",
    keyMove: "Move left and right",
    keyTurn: "Turn",
    keySoft: "Move down faster",
    keyDrop: "Drop to the bottom",
    keyPause: "Pause",
    keySpace: "Space",
    touchHint: "Swipe left or right to move, up to turn, down to drop. The buttons under the well do the same.",
    scoreCaps: "Score",
    bestCaps: "Best",
    levelCaps: "Level",
    linesCaps: "Lines",
    next: "Next",
    gameOver: "Game over",
    gameOverSub: "The stack reached the top.",
    wonTitle: "100 lines cleared",
    newBest: "New best score.",
    menu: "Menu",
    paused: "Paused",
    moveLeft: "Move left",
    rotate: "Turn",
    moveRight: "Move right",
    moveDown: "Move down one row",
    hardDrop: "Drop to the bottom",
  },
  ko: {
    ...common.ko,
    title: "블록 드롭",
    goal: (n: number) => `${n}줄을 지우면 게임이 끝납니다.`,
    start: "시작",
    keyColumn: "키",
    actionColumn: "동작",
    keyMove: "좌우 이동",
    keyTurn: "회전",
    keySoft: "빨리 내리기",
    keyDrop: "맨 아래로 내리기",
    keyPause: "일시 정지",
    keySpace: "Space",
    touchHint: "좌우로 밀면 이동, 위로 밀면 회전, 아래로 밀면 맨 아래로 내립니다. 화면 아래 버튼으로도 할 수 있습니다.",
    scoreCaps: "점수",
    bestCaps: "최고",
    levelCaps: "레벨",
    linesCaps: "줄",
    next: "다음",
    gameOver: "게임 오버",
    gameOverSub: "블록이 맨 위까지 쌓였습니다.",
    wonTitle: "100줄을 다 지웠습니다",
    newBest: "최고 점수를 새로 세웠습니다.",
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

function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
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
      <path d="M5 19h14" />
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
  size = 56,
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

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 4,
    color: primary ? CABINET : KEY_TEXT,
    background: primary ? (down ? "#b8b8b8" : KEY_TEXT) : down ? "#444444" : KEY_BG,
    border: `1px solid ${primary ? KEY_TEXT : KEY_LINE}`,
    touchAction: "none",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex items-center justify-center select-none"
      style={style}
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

function Btn({ onClick, children, primary, autoFocus }: { onClick: () => void; children: ReactNode; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="h-10 min-w-[7rem] px-5 text-base font-bold select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-px"
      style={{
        borderRadius: 3,
        color: primary ? CABINET : TEXT,
        background: primary ? KEY_TEXT : "transparent",
        border: `1px solid ${primary ? KEY_TEXT : FRAME}`,
        fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}

/* A black box with a gray frame, the one panel style used for menus and results. */
function Box({ children, width = 320 }: { children: ReactNode; width?: number }) {
  return (
    <div className="flex flex-col gap-4 px-6 py-6 w-full" style={{ maxWidth: width, background: WELL, border: `2px solid ${FRAME}`, color: TEXT }}>
      {children}
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b" style={{ borderColor: "#2a2a2a" }}>
            <th scope="row" className="py-1.5 text-left font-normal" style={{ color: TEXT_DIM }}>
              {k}
            </th>
            <td className="py-1.5 text-right font-bold tabular-nums" style={{ fontFamily: MONO }}>
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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

  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const { best, record } = useBestScore(BEST_KEY);
  const bestAtStart = useRef<number | null>(null);
  const [showResult, setShowResult] = useState(false);

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
    const piece: Piece = { index, mx: shape, x, y: 0 };
    if (collides(s.board, piece.mx, piece.x, piece.y)) {
      s.piece = null;
      s.deathT = 0;
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
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
    s.board = kept;

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
    if (s.level > prevLevel) sfx("correct");
    if (s.lines >= WIN_LINES) {
      saveBest();
      s.deathT = 0;
      sfx("win");
      goTo("won");
      return;
    }
    spawn();
  }, [goTo, saveBest, sfx, spawn]);

  const lockPiece = useCallback(() => {
    const s = stateRef.current;
    const p = s.piece;
    if (!p) return;
    for (let r = 0; r < p.mx.length; r++) {
      for (let c = 0; c < p.mx[r].length; c++) {
        if (!p.mx[r][c]) continue;
        const y = p.y + r;
        const x = p.x + c;
        if (y >= 0) s.board[y][x] = p.index + 1;
      }
    }
    s.piece = null;

    const full: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (s.board[r].every((v) => v !== 0)) full.push(r);
    }
    if (full.length > 0) {
      s.combo += 1;
      s.clearing = full;
      s.clearTimer = 0;
      sfx(full.length >= 4 ? "win" : "correct");
      return;
    }
    s.combo = 0;
    sfx("place");
    spawn();
  }, [sfx, spawn]);

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
        lockPiece();
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
    let dist = 0;
    while (!collides(s.board, p.mx, p.x, p.y + 1)) {
      p.y += 1;
      dist += 1;
    }
    s.score += dist * 2;
    setScore(s.score);
    lockPiece();
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

  /* Let the stack turn gray before the result box appears. */
  useEffect(() => {
    if (phase !== "over" && phase !== "won") {
      setShowResult(false);
      return;
    }
    const id = window.setTimeout(() => setShowResult(true), phase === "over" ? 800 : 300);
    return () => window.clearTimeout(id);
  }, [phase]);

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
      sp = makeBlock(colorIdx < 0 ? BLOCK_DEAD : BLOCKS[colorIdx], px);
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
          if (s.lockTimer >= (soft ? LOCK_DELAY * 0.4 : LOCK_DELAY)) lockPiece();
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
        ctx.fillStyle = CABINET;
        ctx.fillRect(0, 0, L.lw, L.lh);
        ctx.textBaseline = "alphabetic";

        const bx = L.portrait ? RIM : PANEL_W + PANEL_GAP + RIM;
        const by = L.portrait ? HUD_H + 8 + RIM : RIM;

        /* ----- Readouts: black boxes with a gray frame, labels above plain numbers ----- */
        const panel = (x: number, y: number, w: number, h: number) => {
          ctx.fillStyle = WELL;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = FRAME;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        };
        const label = (text: string, x: number, y: number, align: CanvasTextAlign = "left") => {
          ctx.textAlign = align;
          ctx.fillStyle = TEXT_DIM;
          ctx.font = `700 11px ${FONT}`;
          ctx.fillText(text, x, y);
        };
        const value = (text: string, x: number, y: number, size: number, maxW: number, align: CanvasTextAlign = "left") => {
          ctx.textAlign = align;
          let fs = size;
          ctx.font = `700 ${fs}px ${MONO}`;
          while (fs > 9 && ctx.measureText(text).width > maxW) {
            fs -= 1;
            ctx.font = `700 ${fs}px ${MONO}`;
          }
          ctx.fillStyle = TEXT;
          ctx.fillText(text, x, y);
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

        if (L.portrait) {
          panel(0, 0, 112, HUD_H);
          label(m.scoreCaps, 10, 17);
          value(pad6(s.score), 10, 38, 18, 92);
          ctx.font = `400 11px ${MONO}`;
          ctx.fillStyle = TEXT_DIM;
          ctx.textAlign = "left";
          ctx.fillText(`${m.bestCaps} ${pad6(bestNow)}`, 10, 55, 94);

          panel(118, 0, 62, HUD_H);
          label(m.levelCaps, 126, 17);
          value(String(s.level).padStart(2, "0"), 126, 38, 18, 46);
          ctx.font = `400 11px ${MONO}`;
          ctx.fillStyle = TEXT_DIM;
          ctx.fillText(`${m.linesCaps} ${String(s.lines).padStart(3, "0")}`, 126, 55, 48);

          panel(186, 0, PORT_W - 186, HUD_H);
          label(m.next, 194, 17);
          mini(s.queue[0], 186 + (PORT_W - 186) / 2, 41, 11);
        } else {
          const rx = LAND_W - PANEL_W;
          panel(0, 0, PANEL_W, 196);
          const rows: [string, string][] = [
            [m.scoreCaps, pad6(s.score)],
            [m.bestCaps, pad6(bestNow)],
            [m.levelCaps, String(s.level).padStart(2, "0")],
            [m.linesCaps, `${String(s.lines).padStart(3, "0")}/${WIN_LINES}`],
          ];
          rows.forEach(([k, v], i) => {
            const y = 22 + i * 46;
            label(k, 12, y);
            value(v, 12, y + 22, 20, PANEL_W - 24);
          });

          if (!L.touch) {
            const rowsHint: [string, string][] = [
              ["← →", m.keyMove],
              ["↑", m.keyTurn],
              ["↓", m.keySoft],
              [m.keySpace, m.keyDrop],
              ["P", m.keyPause],
            ];
            let hy = LAND_H - rowsHint.length * 20 - 4;
            for (const [k, txt] of rowsHint) {
              ctx.textAlign = "left";
              ctx.font = `700 11px ${MONO}`;
              ctx.fillStyle = TEXT;
              ctx.fillText(k, 2, hy + 12, 40);
              ctx.font = `400 11px ${FONT}`;
              ctx.fillStyle = TEXT_DIM;
              ctx.fillText(txt, 46, hy + 12, PANEL_W - 46);
              hy += 20;
            }
          }

          panel(rx, 0, PANEL_W, 196);
          label(m.next, rx + 12, 22);
          mini(s.queue[0], rx + PANEL_W / 2, 66, 18);
          mini(s.queue[1], rx + PANEL_W / 2, 120, 12);
          mini(s.queue[2], rx + PANEL_W / 2, 162, 12);
        }

        /* ----- Well ----- */
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(bx - RIM, by - RIM, BW + RIM * 2, BH + RIM * 2);
        ctx.strokeStyle = FRAME;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - RIM + 1, by - RIM + 1, BW + RIM * 2 - 2, BH + RIM * 2 - 2);
        ctx.fillStyle = WELL;
        ctx.fillRect(bx, by, BW, BH);
        ctx.fillStyle = GRID;
        for (let c = 1; c < COLS; c++) ctx.fillRect(bx + c * CELL, by, 1, BH);
        for (let r = 1; r < ROWS; r++) ctx.fillRect(bx, by + r * CELL, BW, 1);

        /* Settled squares. On game over they turn gray from the bottom up. */
        const deadFrom = ph === "over" ? ROWS - s.deathT * 40 : ROWS + 1;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const v = s.board[r][c];
            if (!v) continue;
            ctx.drawImage(sprite(r >= deadFrom ? -1 : v - 1, CELL, pxs), bx + c * CELL, by + r * CELL, CELL, CELL);
          }
        }

        /* Full rows blink before they go. */
        if (s.clearing && Math.floor((s.clearTimer / CLEAR_TIME) * 6) % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          for (const r of s.clearing) ctx.fillRect(bx, by + r * CELL, BW, CELL);
        }

        const p = s.piece;
        if (p && (ph === "playing" || ph === "paused")) {
          /* Outline where the piece lands if dropped now. */
          let gy = p.y;
          while (!collides(s.board, p.mx, p.x, gy + 1)) gy += 1;
          const col = BLOCKS[p.index];
          ctx.strokeStyle = alpha(col, 0.6);
          ctx.lineWidth = 1;
          for (let r = 0; r < p.mx.length; r++) {
            for (let c = 0; c < p.mx[r].length; c++) {
              if (!p.mx[r][c] || gy + r < 0) continue;
              ctx.strokeRect(bx + (p.x + c) * CELL + 1.5, by + (gy + r) * CELL + 1.5, CELL - 3, CELL - 3);
            }
          }
          const sp = sprite(p.index, CELL, pxs);
          for (let r = 0; r < p.mx.length; r++) {
            for (let c = 0; c < p.mx[r].length; c++) {
              if (!p.mx[r][c] || p.y + r < 0) continue;
              ctx.drawImage(sp, bx + (p.x + c) * CELL, by + (p.y + r) * CELL, CELL, CELL);
            }
          }
        }

        if (ph === "paused" || ((ph === "over" || ph === "won") && s.deathT > 0.4)) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fillRect(bx, by, BW, BH);
        }
      },
    },
    phase !== "idle",
  );

  /* ---------- Render ---------- */

  const rootStyle: CSSProperties = {
    height: box.h,
    background: CABINET,
    color: TEXT,
    fontFamily: FONT,
    touchAction: phase === "playing" ? "none" : undefined,
  };
  const rootClass = "relative w-full overflow-hidden select-none";
  const fmt = (n: number) => n.toLocaleString("en-US");

  if (phase === "idle") {
    const keyRows: [string, string][] = [
      ["← →", m.keyMove],
      ["↑", m.keyTurn],
      ["↓", m.keySoft],
      [m.keySpace, m.keyDrop],
      ["P", m.keyPause],
    ];
    return (
      <div ref={rootRef} className={rootClass} style={rootStyle}>
        <div className="h-full flex items-center justify-center px-4 pt-12 pb-4">
          <Box width={340}>
            <h1 className="text-3xl font-bold leading-tight">{m.title}</h1>
            <Rows rows={[[m.bestCaps, best !== null ? pad6(best) : pad6(0)]]} />
            <Btn onClick={startGame} primary autoFocus>
              {m.start}
            </Btn>
            <p className="text-sm" style={{ color: TEXT_DIM }}>
              {m.goal(WIN_LINES)}
            </p>
            {box.touch ? (
              <p className="text-sm leading-relaxed" style={{ color: TEXT_DIM }}>
                {m.touchHint}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: TEXT_DIM }}>
                    <th className="pb-1 text-left font-normal w-20">{m.keyColumn}</th>
                    <th className="pb-1 text-left font-normal">{m.actionColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyRows.map(([k, v]) => (
                    <tr key={v}>
                      <td className="py-0.5 font-bold" style={{ fontFamily: MONO }}>
                        {k}
                      </td>
                      <td className="py-0.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Box>
        </div>
      </div>
    );
  }

  const ended = phase === "over" || phase === "won";
  const isNewBest = ended && score > 0 && score > (bestAtStart.current ?? 0);
  const padSize = portrait ? Math.min(56, Math.floor((box.w - 24 - 4 * 8) / 5)) : 56;

  const leftPad = (
    <div className="flex flex-col items-center gap-2" style={{ width: SIDE_PAD_W }}>
      <div className="flex gap-2">
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
    <div className="flex flex-col items-center gap-2" style={{ width: SIDE_PAD_W }}>
      <PadButton label={m.rotate} onPress={() => rotate(1)} size={padSize + 8}>
        <Svg size={28}>{ICON.rotate}</Svg>
      </PadButton>
      <PadButton label={m.hardDrop} onPress={hardDrop} primary size={padSize + 8}>
        <Svg size={28}>{ICON.drop}</Svg>
      </PadButton>
    </div>
  );
  const bottomPad = (
    <div className="flex items-center justify-center gap-2 w-full" style={{ height: PAD_ROW_H }}>
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
          className="absolute left-2.5 top-2.5 w-9 h-9 flex items-center justify-center"
          style={{ background: KEY_BG, border: `1px solid ${KEY_LINE}`, borderRadius: 3, color: KEY_TEXT }}
        >
          <Svg size={18}>{ICON.pause}</Svg>
        </button>
      )}

      {phase === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Box width={280}>
            <h2 className="text-2xl font-bold">{m.paused}</h2>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={togglePause} primary autoFocus>
                {m.resume}
              </Btn>
              <Btn onClick={quit}>{m.quit}</Btn>
            </div>
          </Box>
        </div>
      )}

      {ended && showResult && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Box width={300}>
            <div>
              <h2 className="text-2xl font-bold">{phase === "won" ? m.wonTitle : m.gameOver}</h2>
              {phase === "over" && (
                <p className="mt-1 text-sm" style={{ color: TEXT_DIM }}>
                  {m.gameOverSub}
                </p>
              )}
            </div>
            <Rows
              rows={[
                [m.scoreCaps, fmt(score)],
                [m.linesCaps, String(lines)],
                [m.levelCaps, String(level)],
                [m.bestCaps, fmt(Math.max(best ?? 0, score))],
              ]}
            />
            {isNewBest && <p className="text-sm font-bold">{m.newBest}</p>}
            <div className="flex flex-wrap gap-2">
              <Btn onClick={playAgain} primary autoFocus>
                {m.playAgain}
              </Btn>
              <Btn onClick={quit}>{m.menu}</Btn>
            </div>
          </Box>
        </div>
      )}
    </div>
  );
}
