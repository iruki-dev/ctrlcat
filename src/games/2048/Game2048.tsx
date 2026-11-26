import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLang, useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { useBestScore } from "../lib/useBestScore";
import { useSwipe } from "../lib/useInput";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { useSound } from "../../components/games/SoundContext";

const SIZE = 4;
const TARGET = 2048;
const BEST_KEY = "ctrlcat-2048-best";
/** Tile slide duration. New tiles pop and merged tiles bounce once the slide lands. */
const SLIDE_MS = 110;
/** Values that get a callout over the board the first time they appear in a game (2048 has its own screen). */
const MILESTONES = [256, 512, 1024, 4096, 8192, 16384];

// "Prism" look: each value walks one step along the spectrum, from pale ice through teal, blue and violet
// to rose, coral, amber and finally a glowing gold 2048. Above that, obsidian tiles with a gold rim.
// Like canvas drawing constants, these are game-owned colors that carry the identity on any site theme.
interface Swatch {
  top: string;
  bottom: string;
  edge: string;
  text: string;
  glow?: string;
}
const PALETTE: Record<number, Swatch> = {
  2: { top: "#F2F6FF", bottom: "#D3DEF5", edge: "#9EAED3", text: "#33415F" },
  4: { top: "#D4FAEF", bottom: "#A2E9D6", edge: "#62BFA6", text: "#134A3E" },
  8: { top: "#6FEBD6", bottom: "#1FB9A6", edge: "#0E7F72", text: "#FFFFFF" },
  16: { top: "#5FCBFA", bottom: "#1C86D6", edge: "#105A99", text: "#FFFFFF" },
  32: { top: "#7D97FF", bottom: "#3D57DE", edge: "#28399E", text: "#FFFFFF" },
  64: { top: "#A98DFF", bottom: "#6A46DE", edge: "#47279F", text: "#FFFFFF" },
  128: { top: "#DE84FF", bottom: "#A63BDD", edge: "#71219C", text: "#FFFFFF", glow: "rgba(214,110,255,0.35)" },
  256: { top: "#FF80BF", bottom: "#E0347F", edge: "#9C1C54", text: "#FFFFFF", glow: "rgba(255,95,170,0.4)" },
  512: { top: "#FF9C78", bottom: "#E84F33", edge: "#A3301C", text: "#FFFFFF", glow: "rgba(255,120,80,0.45)" },
  1024: { top: "#FFC562", bottom: "#EE8715", edge: "#A85A07", text: "#FFFFFF", glow: "rgba(255,170,50,0.5)" },
  2048: { top: "#FFF0A0", bottom: "#FFC21A", edge: "#B57F00", text: "#5A3A00", glow: "rgba(255,214,60,0.7)" },
};
const OBSIDIAN: Swatch = { top: "#3A3F63", bottom: "#161A31", edge: "#000000", text: "#FFD54A", glow: "rgba(255,213,74,0.55)" };

const BOARD_BG = "linear-gradient(160deg, #1D2750 0%, #121937 100%)";
const BOARD_RIM = "#2C3870";
const WELL_BG = "#0C1229";
const PANEL_BG = "rgba(18, 25, 55, 0.92)";
const PANEL_RIM = "rgba(120, 140, 230, 0.25)";
const PANEL_LABEL = "#8FA3DF";
const PANEL_TEXT = "#FFFFFF";
const PLAY_TOP = "#8A7DFF";
const PLAY_BOTTOM = "#D04BEA";
const PLAY_EDGE = "#7A2AA6";
const SCORE_POP = "#FFD54A";
const OVERLAY_BG = "rgba(8, 12, 30, 0.82)";
const TILE_FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", Roboto, system-ui, sans-serif';

function swatch(value: number): Swatch {
  return PALETTE[value] ?? OBSIDIAN;
}

type Dir = "up" | "down" | "left" | "right";
type Phase = "idle" | "playing" | "won" | "lost";

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** Move number on which this tile appeared, and the delay before it pops in. */
  bornAt: number;
  popDelay: number;
  /** Move number on which this tile last absorbed another, or -1. */
  mergedAt: number;
  /** A tile that was absorbed this move: it slides into place under the merged tile, then goes away. */
  ghost?: boolean;
}

/** Maps the i-th slot of line `line` to a board cell, for the given direction. */
function cellAt(line: number, i: number, dir: Dir) {
  switch (dir) {
    case "left":
      return { row: line, col: i };
    case "right":
      return { row: line, col: SIZE - 1 - i };
    case "up":
      return { row: i, col: line };
    case "down":
      return { row: SIZE - 1 - i, col: line };
  }
}

function emptyCells(tiles: Tile[]) {
  const taken = new Set(tiles.map((t) => t.row * SIZE + t.col));
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!taken.has(i)) cells.push({ row: Math.floor(i / SIZE), col: i % SIZE });
  }
  return cells;
}

function hasMoves(tiles: Tile[]) {
  if (tiles.length < SIZE * SIZE) return true;
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
  tiles.forEach((t) => {
    grid[t.row][t.col] = t;
  });
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]?.value;
      if (v === undefined) return true;
      if (c + 1 < SIZE && grid[r][c + 1]?.value === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c]?.value === v) return true;
    }
  }
  return false;
}

/** Slides and merges every line toward `dir`. Returns fresh tiles, the absorbed tiles at their final cell, and the points gained. */
function slide(tiles: Tile[], dir: Dir, moveNo: number) {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
  tiles.forEach((t) => {
    grid[t.row][t.col] = { ...t };
  });

  const result: Tile[] = [];
  const ghosts: Tile[] = [];
  let gained = 0;
  let merges = 0;
  let changed = false;

  for (let line = 0; line < SIZE; line++) {
    const queue: Tile[] = [];
    for (let i = 0; i < SIZE; i++) {
      const p = cellAt(line, i, dir);
      const t = grid[p.row][p.col];
      if (t) queue.push(t);
    }

    let slot = 0;
    let i = 0;
    while (i < queue.length) {
      const a = queue[i];
      const b = queue[i + 1];
      const p = cellAt(line, slot, dir);
      if (b && b.value === a.value) {
        a.value *= 2;
        a.mergedAt = moveNo;
        gained += a.value;
        merges += 1;
        changed = true;
        ghosts.push({ ...b, row: p.row, col: p.col, ghost: true });
        i += 2;
      } else {
        i += 1;
      }
      if (a.row !== p.row || a.col !== p.col) changed = true;
      a.row = p.row;
      a.col = p.col;
      result.push(a);
      slot += 1;
    }
  }

  return { tiles: result, ghosts, gained, merges, changed };
}

const messages = {
  en: {
    ...common.en,
    play: "Play",
    tagline: "Slide. Merge. Glow.",
    howTo: "Slide the tiles. Matching numbers join into one. Reach 2048.",
    keysHint: "Arrow keys or WASD",
    swipeHint: "Swipe or drag the board",
    menu: "Menu",
    wonTitle: "You made 2048",
    wonSub: "Keep going for a bigger tile, or start a fresh board.",
    keepPlaying: "Keep going",
    lostTitle: "Out of moves",
    topTileIs: (n: number) => `Top tile ${n}`,
    newBest: "New best",
    milestone: (n: number): string =>
      n >= 8192 ? "Unreal" : n >= 4096 ? "Legendary" : n >= 1024 ? "Amazing" : n >= 512 ? "Superb" : "Great",
    pressEnter: "Press Enter to play again",
    moveUp: "Move up",
    moveLeft: "Move left",
    moveDown: "Move down",
    moveRight: "Move right",
    board: "Game board",
  },
  ko: {
    ...common.ko,
    play: "시작하기",
    tagline: "밀고, 합치고, 빛내세요.",
    howTo: "타일을 밀어 같은 숫자를 하나로 합치세요. 목표는 2048입니다.",
    keysHint: "방향키 또는 WASD",
    swipeHint: "판을 밀거나 끌기",
    menu: "메뉴",
    wonTitle: "2048 달성",
    wonSub: "더 큰 타일에 도전하거나 새 판을 시작하세요.",
    keepPlaying: "계속하기",
    lostTitle: "더 움직일 수 없어요",
    topTileIs: (n: number) => `최고 타일 ${n}`,
    newBest: "최고 기록 경신",
    milestone: (n: number): string =>
      n >= 8192 ? "믿을 수 없어요" : n >= 4096 ? "전설적이에요" : n >= 1024 ? "놀라워요" : n >= 512 ? "훌륭해요" : "좋아요",
    pressEnter: "Enter 키로 다시 하기",
    moveUp: "위로",
    moveLeft: "왼쪽으로",
    moveDown: "아래로",
    moveRight: "오른쪽으로",
    board: "게임 판",
  },
};

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduce;
}

function useSize() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

/** Glossy, lit block shared by board tiles and the title. */
function Block({ value, size, label, style }: { value: number; size: number; label?: string; style?: CSSProperties }) {
  const s = swatch(value);
  const text = label ?? String(value);
  const len = text.length;
  const fontScale = len <= 2 ? 0.48 : len === 3 ? 0.38 : len === 4 ? 0.3 : 0.25;
  const radius = Math.max(6, size * 0.16);
  const depth = Math.max(2, Math.round(size * 0.05));
  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(180deg, ${s.top} 0%, ${s.bottom} 100%)`,
        boxShadow: [
          `inset 0 ${Math.max(1, depth / 2)}px 0 rgba(255,255,255,0.55)`,
          `inset 0 -${depth}px 0 rgba(0,0,0,0.14)`,
          `0 ${depth}px 0 ${s.edge}`,
          `0 ${depth + 4}px ${depth * 3}px rgba(0,0,0,0.35)`,
          s.glow ? `0 0 ${size * 0.35}px ${s.glow}` : "",
        ]
          .filter(Boolean)
          .join(", "),
        border: value > TARGET ? `2px solid ${OBSIDIAN.text}` : undefined,
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          left: "8%",
          right: "8%",
          top: "5%",
          height: "42%",
          borderRadius: radius * 0.8,
          background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <span
        className="relative tabular-nums leading-none"
        style={{
          fontFamily: TILE_FONT,
          fontWeight: 900,
          fontSize: size * fontScale,
          color: s.text,
          letterSpacing: len >= 4 ? "-0.04em" : "-0.02em",
          textShadow: s.text === "#FFFFFF" ? "0 2px 0 rgba(0,0,0,0.22)" : "0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function BoardTile({
  tile,
  cell,
  x,
  y,
  shownValue,
  reduce,
}: {
  tile: Tile;
  cell: number;
  x: number;
  y: number;
  shownValue: number;
  reduce: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce || !inner.current?.animate) return;
    inner.current.animate(
      [
        { transform: "scale(0.1)", opacity: 0 },
        { transform: "scale(1.08)", opacity: 1, offset: 0.7 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 190, delay: tile.popDelay, easing: "cubic-bezier(.2,.8,.3,1.2)", fill: "backwards" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduce || tile.mergedAt < 0 || !inner.current?.animate) return;
    inner.current.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.2)", offset: 0.45 }, { transform: "scale(1)" }],
      { duration: 210, delay: SLIDE_MS, easing: "ease-out" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.mergedAt]);

  return (
    <div
      className="absolute left-0 top-0"
      style={{
        width: cell,
        height: cell,
        transform: `translate(${x}px, ${y}px)`,
        transition: reduce ? "none" : `transform ${SLIDE_MS}ms ease-out`,
        zIndex: tile.ghost ? 1 : 2,
      }}
    >
      <div ref={inner} style={{ width: cell, height: cell }}>
        <Block value={shownValue} size={cell} />
      </div>
    </div>
  );
}

function FloatUp({ children, reduce, style }: { children: ReactNode; reduce: boolean; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current?.animate) return;
    ref.current.animate(
      reduce
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: "translate(-50%, 6px) scale(0.8)", opacity: 0 },
            { transform: "translate(-50%, -8px) scale(1.1)", opacity: 1, offset: 0.2 },
            { transform: "translate(-50%, -44px) scale(1)", opacity: 0 },
          ],
      { duration: 800, easing: "ease-out", fill: "forwards" },
    );
  }, [reduce]);
  return (
    <div
      ref={ref}
      className="absolute left-1/2 pointer-events-none whitespace-nowrap tabular-nums"
      style={{ transform: "translate(-50%, 0)", ...style }}
    >
      {children}
    </div>
  );
}

function Callout({ value, word, reduce }: { value: number; word: string; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current?.animate) return;
    ref.current.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
        : [
            { transform: "scale(0.4) rotate(-6deg)", opacity: 0 },
            { transform: "scale(1.12) rotate(2deg)", opacity: 1, offset: 0.15 },
            { transform: "scale(1) rotate(0deg)", opacity: 1, offset: 0.3 },
            { transform: "scale(1) rotate(0deg)", opacity: 1, offset: 0.8 },
            { transform: "scale(1.3)", opacity: 0 },
          ],
      { duration: 1500, delay: SLIDE_MS, easing: "ease-out", fill: "both" },
    );
  }, [reduce]);
  const s = swatch(value);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <div
        ref={ref}
        className="flex flex-col items-center gap-1 rounded-3xl px-6 py-3"
        style={{ background: "rgba(8, 12, 30, 0.72)", boxShadow: `0 0 0 2px ${s.bottom}, 0 12px 40px rgba(0,0,0,0.5), 0 0 40px ${s.glow ?? s.bottom}` }}
      >
        <div
          style={{
            fontFamily: TILE_FONT,
            fontWeight: 900,
            fontSize: 44,
            lineHeight: 1,
            color: "#FFFFFF",
            textShadow: `0 3px 0 ${s.edge}, 0 0 24px ${s.glow ?? s.bottom}`,
            WebkitTextStroke: `1px ${s.edge}`,
          }}
        >
          {word}
        </div>
        <div
          className="tabular-nums"
          style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: 22, color: s.top, textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Burst({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduce || !ref.current) return;
    const colors = [2048, 1024, 512, 256, 128, 64, 32, 16, 8].map((v) => PALETTE[v].top);
    const kids = Array.from(ref.current.children) as HTMLElement[];
    kids.forEach((el, i) => {
      const angle = (i / kids.length) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 120 + Math.random() * 120;
      el.style.background = colors[i % colors.length];
      el.animate?.(
        [
          { transform: "translate(-50%, -50%) rotate(0deg) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(${
              Math.random() * 540
            }deg) scale(0.4)`,
            opacity: 0,
          },
        ],
        { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" },
      );
    });
  }, [reduce]);
  if (reduce) return null;
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 pointer-events-none z-30">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{ width: 10, height: 10, borderRadius: 3, transform: "translate(-50%, -50%)", opacity: 0 }}
        />
      ))}
    </div>
  );
}

function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const lang = useLang();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <>{shown.toLocaleString(lang)}</>;
}

function PlayButton({
  children,
  onClick,
  big,
  reduce,
  autoFocus,
}: {
  children: ReactNode;
  onClick: () => void;
  big?: boolean;
  reduce?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
    if (reduce || !big || !ref.current?.animate) return;
    const a = ref.current.animate([{ scale: "1" }, { scale: "1.04" }, { scale: "1" }], {
      duration: 1600,
      iterations: Infinity,
      easing: "ease-in-out",
    });
    return () => a.cancel();
  }, [big, reduce, autoFocus]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="relative rounded-full font-black tracking-wide text-white transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      style={{
        fontFamily: TILE_FONT,
        fontSize: big ? 26 : 19,
        padding: big ? "16px 56px" : "12px 34px",
        background: `linear-gradient(180deg, ${PLAY_TOP} 0%, ${PLAY_BOTTOM} 100%)`,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.45), 0 5px 0 ${PLAY_EDGE}, 0 10px 28px rgba(208,75,234,0.45)`,
        textShadow: "0 2px 0 rgba(0,0,0,0.2)",
      }}
    >
      {children}
    </button>
  );
}

function RoundButton({ label, onClick, children, size = 44, width }: { label: string; onClick: () => void; children: ReactNode; size?: number; width?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center justify-center rounded-2xl transition-[filter,transform] duration-100 hover:brightness-125 active:translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ width: width ?? size, height: size, background: PANEL_BG, border: `1px solid ${PANEL_RIM}`, color: PANEL_LABEL }}
    >
      {children}
    </button>
  );
}

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const RestartIcon = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 3 3 9 9 9" />
  </Svg>
);
const MenuIcon = () => (
  <Svg>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);
const ARROW_ROT: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
const Arrow = ({ dir, size = 22 }: { dir: Dir; size?: number }) => (
  <span style={{ display: "inline-flex", transform: `rotate(${ARROW_ROT[dir]}deg)` }}>
    <Svg size={size}>
      <polyline points="6 14 12 8 18 14" />
    </Svg>
  </span>
);

function StatCard({ label, children, extra, compact }: { label: string; children: ReactNode; extra?: ReactNode; compact?: boolean }) {
  return (
    <div
      className="relative flex-1 min-w-0 flex flex-col items-center justify-center rounded-2xl"
      style={{ background: PANEL_BG, border: `1px solid ${PANEL_RIM}`, padding: compact ? "6px 10px" : "8px 12px", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: PANEL_LABEL }}>
        {label}
      </span>
      <span className="tabular-nums leading-tight" style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: compact ? 22 : 26, color: PANEL_TEXT }}>
        {children}
      </span>
      {extra}
    </div>
  );
}

function Logo({ size, reduce, bob }: { size: number; reduce: boolean; bob?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bob || reduce || !ref.current) return;
    const anims = (Array.from(ref.current.children) as HTMLElement[]).map((el, i) =>
      el.animate?.([{ translate: "0 0" }, { translate: `0 -${Math.round(size * 0.08)}px` }], {
        duration: 1300,
        delay: i * 160,
        direction: "alternate",
        iterations: Infinity,
        easing: "ease-in-out",
      }),
    );
    return () => anims.forEach((a) => a?.cancel());
  }, [bob, reduce, size]);
  const digits: [string, number, number][] = [
    ["2", 8, -5],
    ["0", 32, 3],
    ["4", 128, -3],
    ["8", 2048, 5],
  ];
  return (
    <div ref={ref} className="flex items-end" style={{ gap: size * 0.12 }} aria-label="2048" role="img">
      {digits.map(([d, v, rot]) => (
        <div key={d} style={{ transform: `rotate(${rot}deg)` }}>
          <Block value={v} size={size} label={d} />
        </div>
      ))}
    </div>
  );
}

export default function Game2048() {
  const m = useMessages(messages);
  const lang = useLang();
  const { play } = useSound();
  const reduce = useReducedMotion();
  const [rootRef, area] = useSize();

  const [phase, setPhase] = useState<Phase>("idle");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ghosts, setGhosts] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [moveNo, setMoveNo] = useState(0);
  const [settled, setSettled] = useState(0);
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  const [callout, setCallout] = useState<{ id: number; value: number } | null>(null);
  const [overlayReady, setOverlayReady] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, record } = useBestScore(BEST_KEY);
  usePhaseEvents(phase, { score });

  // Authoritative game state, updated synchronously so fast key repeats never act on a stale board.
  const game = useRef({ tiles: [] as Tile[], score: 0, phase: "idle" as Phase, keepPlaying: false, moveNo: 0, reached: 0, bestAtStart: 0 });
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const spawn = useCallback((current: Tile[], count: number, moveId: number, delay: number) => {
    const out = [...current];
    for (let i = 0; i < count; i++) {
      const cells = emptyCells(out);
      if (!cells.length) break;
      const cell = cells[Math.floor(Math.random() * cells.length)];
      out.push({
        id: nextId.current++,
        value: Math.random() < 0.9 ? 2 : 4,
        row: cell.row,
        col: cell.col,
        bornAt: moveId,
        popDelay: delay + i * 60,
        mergedAt: -1,
      });
    }
    return out;
  }, []);

  const setGamePhase = (p: Phase) => {
    game.current.phase = p;
    setPhase(p);
  };

  const startGame = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    const fresh = spawn([], 2, 0, 80);
    game.current = {
      tiles: fresh,
      score: 0,
      phase: "playing",
      keepPlaying: false,
      moveNo: 0,
      reached: 0,
      bestAtStart: best ?? 0,
    };
    setTiles(fresh);
    setGhosts([]);
    setScore(0);
    setMoveNo(0);
    setSettled(0);
    setFloats([]);
    setCallout(null);
    setOverlayReady(false);
    setNewBest(false);
    setPhase("playing");
  }, [spawn, best]);

  const move = useCallback(
    (dir: Dir) => {
      const g = game.current;
      if (g.phase !== "playing") return;
      const id = g.moveNo + 1;
      const { tiles: moved, ghosts: gone, gained, merges, changed } = slide(g.tiles, dir, id);
      if (!changed) {
        if (!reduce && boardRef.current?.animate) {
          const dx = dir === "left" ? -4 : dir === "right" ? 4 : 0;
          const dy = dir === "up" ? -4 : dir === "down" ? 4 : 0;
          boardRef.current.animate([{ translate: "0 0" }, { translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 140, easing: "ease-out" });
        }
        return;
      }
      const slideMs = reduce ? 0 : SLIDE_MS;
      const withNew = spawn(moved, 1, id, slideMs);
      g.tiles = withNew;
      g.moveNo = id;
      g.score += gained;
      setTiles(withNew);
      setGhosts(gone);
      setMoveNo(id);
      setScore(g.score);
      if (reduce) setSettled(id);
      later(() => {
        setGhosts((cur) => (cur === gone ? [] : cur));
        setSettled((s) => Math.max(s, id));
      }, slideMs);
      if (gained > 0) {
        record(g.score);
        if (g.score > g.bestAtStart && g.bestAtStart > 0) setNewBest(true);
        setFloats((f) => [...f.slice(-4), { id, amount: gained }]);
        later(() => setFloats((f) => f.filter((x) => x.id !== id)), 850);
      }

      const highest = withNew.reduce((mx, t) => Math.max(mx, t.value), 0);
      if (!g.keepPlaying && highest >= TARGET) {
        play("win");
        setGamePhase("won");
        later(() => setOverlayReady(true), slideMs + 350);
        return;
      }
      if (highest > g.reached && MILESTONES.includes(highest)) {
        play("correct");
        setCallout({ id, value: highest });
        later(() => setCallout((c) => (c?.id === id ? null : c)), 1700);
      } else if (merges > 0) {
        play("place");
      }
      g.reached = Math.max(g.reached, highest);

      if (!hasMoves(withNew)) {
        setGamePhase("lost");
        later(() => {
          play("lose");
          if (!reduce && boardRef.current?.animate) {
            boardRef.current.animate(
              [{ translate: "0 0" }, { translate: "-8px 0" }, { translate: "8px 0" }, { translate: "-5px 0" }, { translate: "3px 0" }, { translate: "0 0" }],
              { duration: 420, easing: "ease-out" },
            );
          }
        }, slideMs + 150);
        later(() => setOverlayReady(true), slideMs + 750);
      }
    },
    [spawn, record, play, reduce],
  );

  const keepGoing = () => {
    game.current.keepPlaying = true;
    game.current.reached = Math.max(game.current.reached, TARGET);
    setOverlayReady(false);
    setGamePhase("playing");
  };
  const playAgain = () => afterBreak(startGame);
  const toMenu = () => {
    setOverlayReady(false);
    setGamePhase("idle");
  };

  useEffect(() => {
    const keyMap: Record<string, Dir> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const p = game.current.phase;
      if (p === "playing") {
        const dir = keyMap[e.key] ?? keyMap[e.key.toLowerCase()];
        if (!dir) return;
        e.preventDefault();
        move(dir);
      } else if (p === "lost" && e.key === "Enter" && overlayReady) {
        if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
        e.preventDefault();
        afterBreak(startGame);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, overlayReady, startGame]);

  useSwipe((dir) => move(dir));

  // Mouse drag on the board, for desktop players without arrow keys at hand.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start || e.pointerType !== "mouse") return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const W = area.w;
  const H = area.h;
  const fmt = (n: number) => n.toLocaleString(lang);

  if (phase === "idle") {
    const logo = Math.max(48, Math.min(104, W * 0.17, H * 0.16));
    return (
      <div ref={rootRef} className="h-full w-full flex flex-col items-center justify-center px-4 py-6 text-center">
        <div className="flex flex-col items-center" style={{ gap: Math.min(28, H * 0.04) }}>
          <div className="flex flex-col items-center gap-3">
            <Logo size={logo} reduce={reduce} bob />
            <p className="mt-2 font-black tracking-[0.2em] uppercase text-game-text-dim" style={{ fontFamily: TILE_FONT, fontSize: Math.max(13, logo * 0.2) }}>
              {m.tagline}
            </p>
          </div>
          <PlayButton onClick={startGame} big reduce={reduce} autoFocus>
            {m.play}
          </PlayButton>
          {best !== null && (
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ background: PANEL_BG, border: `1px solid ${PANEL_RIM}` }}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: PANEL_LABEL }}>
                {m.best}
              </span>
              <span className="tabular-nums" style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: 18, color: SCORE_POP }}>
                {fmt(best)}
              </span>
            </div>
          )}
          <div className="flex flex-col items-center gap-2 max-w-xs">
            <p className="text-sm text-game-text-dim">{m.howTo}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-game-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                  {(["left", "up", "down", "right"] as Dir[]).map((d) => (
                    <span key={d} className="inline-flex items-center justify-center w-5 h-5 rounded border border-game-border-dim bg-game-surface-2/60">
                      <Arrow dir={d} size={12} />
                    </span>
                  ))}
                </span>
                {m.keysHint}
              </span>
              <span>{m.swipeHint}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Layout: a side panel beside the board on wide stages, a compact HUD above it on tall ones.
  // The top 56px stay clear on the right for the portal's mute and fullscreen buttons.
  const side = W >= 560 && W > H * 1.15;
  const TOP = 56;
  const panelW = side ? Math.max(190, Math.min(240, W * 0.28)) : 0;
  const boardSize = Math.max(
    200,
    Math.floor(
      side
        ? Math.min(H - TOP - 16, W - panelW - 24 - 32, 640)
        : Math.min(W - 24, H - TOP - 64 - 12 - 40, 560),
    ),
  );
  const pad = boardSize * 0.032;
  const gap = boardSize * 0.03;
  const cell = (boardSize - pad * 2 - gap * (SIZE - 1)) / SIZE;
  const at = (i: number) => pad + i * (cell + gap);
  const highest = tiles.reduce((mx, t) => Math.max(mx, t.value), 0);

  const scoreCard = (
    <StatCard
      label={m.score}
      compact={!side}
      extra={floats.map((f) => (
        <FloatUp key={f.id} reduce={reduce} style={{ top: "30%" }}>
          <span style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: 20, color: SCORE_POP, textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
            +{f.amount}
          </span>
        </FloatUp>
      ))}
    >
      {fmt(score)}
    </StatCard>
  );
  const bestCard = (
    <StatCard label={m.best} compact={!side}>
      {best !== null ? fmt(Math.max(best, score)) : "-"}
    </StatCard>
  );

  const board = (
    <div
      ref={boardRef}
      role="group"
      aria-label={m.board}
      className="relative select-none touch-none shrink-0"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={() => (drag.current = null)}
      style={{
        width: boardSize,
        height: boardSize,
        borderRadius: boardSize * 0.06,
        background: BOARD_BG,
        boxShadow: `0 0 0 2px ${BOARD_RIM}, 0 ${boardSize * 0.025}px 0 #0A0F24, 0 24px 60px rgba(0,0,0,0.45)`,
      }}
    >
      {Array.from({ length: SIZE * SIZE }).map((_, i) => (
        <div
          key={`cell-${i}`}
          className="absolute"
          style={{
            left: at(i % SIZE),
            top: at(Math.floor(i / SIZE)),
            width: cell,
            height: cell,
            borderRadius: Math.max(6, cell * 0.16),
            background: WELL_BG,
            boxShadow: "inset 0 3px 8px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
      ))}
      {[...ghosts, ...tiles].map((t) => (
        <BoardTile
          key={t.id}
          tile={t}
          cell={cell}
          x={at(t.col)}
          y={at(t.row)}
          reduce={reduce}
          shownValue={!t.ghost && t.mergedAt === moveNo && settled < moveNo ? t.value / 2 : t.value}
        />
      ))}
      {callout && <Callout key={callout.id} value={callout.value} word={m.milestone(callout.value)} reduce={reduce} />}

      {(phase === "won" || phase === "lost") && overlayReady && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center animate-fade-in"
          style={{ background: OVERLAY_BG, borderRadius: boardSize * 0.06, backdropFilter: "blur(3px)", gap: boardSize * 0.035, padding: boardSize * 0.06 }}
        >
          {phase === "won" && <Burst reduce={reduce} />}
          {phase === "won" ? (
            <Block value={TARGET} size={boardSize * 0.24} style={{ transform: "rotate(-4deg)" }} />
          ) : (
            <Block value={highest} size={boardSize * 0.16} />
          )}
          <h2
            className="leading-tight"
            style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: Math.max(24, boardSize * 0.08), color: phase === "won" ? PALETTE[2048].top : "#FFFFFF" }}
          >
            {phase === "won" ? m.wonTitle : m.lostTitle}
          </h2>
          {phase === "won" ? (
            <p className="text-sm max-w-[16rem]" style={{ color: PANEL_LABEL }}>
              {m.wonSub}
            </p>
          ) : (
            <p className="text-sm font-bold" style={{ color: PANEL_LABEL }}>
              {m.topTileIs(highest)}
            </p>
          )}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: PANEL_LABEL }}>
              {m.score}
            </span>
            <span className="tabular-nums leading-none" style={{ fontFamily: TILE_FONT, fontWeight: 900, fontSize: Math.max(36, boardSize * 0.12), color: PANEL_TEXT }}>
              <CountUp value={score} reduce={reduce} />
            </span>
            {newBest && (
              <span
                className="mt-2 rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-[0.12em]"
                style={{ background: SCORE_POP, color: "#4A3000" }}
              >
                {m.newBest}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
            {phase === "won" ? (
              <>
                <PlayButton onClick={keepGoing} reduce={reduce} autoFocus>
                  {m.keepPlaying}
                </PlayButton>
                <RoundButton label={m.newGame} onClick={playAgain} size={48}>
                  <RestartIcon />
                </RoundButton>
              </>
            ) : (
              <>
                <PlayButton onClick={playAgain} big={boardSize > 320} reduce={reduce} autoFocus>
                  {m.playAgain}
                </PlayButton>
                <RoundButton label={m.menu} onClick={toMenu} size={48}>
                  <MenuIcon />
                </RoundButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const pad3 = (
    <div className="grid grid-cols-3 gap-1.5" style={{ width: 3 * 44 + 2 * 6 }}>
      <div />
      <RoundButton label={m.moveUp} onClick={() => move("up")}>
        <Arrow dir="up" />
      </RoundButton>
      <div />
      <RoundButton label={m.moveLeft} onClick={() => move("left")}>
        <Arrow dir="left" />
      </RoundButton>
      <RoundButton label={m.moveDown} onClick={() => move("down")}>
        <Arrow dir="down" />
      </RoundButton>
      <RoundButton label={m.moveRight} onClick={() => move("right")}>
        <Arrow dir="right" />
      </RoundButton>
    </div>
  );

  if (side) {
    return (
      <div ref={rootRef} className="h-full w-full flex items-start justify-center gap-6 px-4 overflow-hidden" style={{ paddingTop: Math.max(TOP, (H - boardSize) / 2), paddingBottom: 16 }}>
        <div className="flex flex-col items-center gap-4 shrink-0" style={{ width: panelW, minHeight: boardSize }}>
          <Logo size={Math.min(44, panelW / 5)} reduce={reduce} />
          <div className="flex w-full gap-2">
            {scoreCard}
            {bestCard}
          </div>
          <div className="flex gap-2">
            <RoundButton label={m.newGame} onClick={startGame}>
              <RestartIcon />
            </RoundButton>
            <RoundButton label={m.menu} onClick={toMenu}>
              <MenuIcon />
            </RoundButton>
          </div>
          <div className="flex-1" />
          {pad3}
          <p className="text-xs text-game-muted text-center">{m.keysHint}</p>
        </div>
        {board}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="h-full w-full flex flex-col items-center overflow-hidden px-3 pb-3">
      <div className="shrink-0 flex items-center self-stretch" style={{ height: TOP, maxWidth: boardSize, margin: "0 auto", width: "100%" }}>
        <Logo size={30} reduce={reduce} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3" style={{ width: boardSize }}>
        <div className="flex w-full items-stretch gap-2" style={{ height: 64 }}>
          {scoreCard}
          {bestCard}
          <RoundButton label={m.newGame} onClick={startGame} size={64} width={48}>
            <RestartIcon />
          </RoundButton>
          <RoundButton label={m.menu} onClick={toMenu} size={64} width={48}>
            <MenuIcon />
          </RoundButton>
        </div>
        {board}
        <p className="text-xs text-game-muted text-center" style={{ minHeight: 16 }}>
          {m.swipeHint}
        </p>
      </div>
    </div>
  );
}
