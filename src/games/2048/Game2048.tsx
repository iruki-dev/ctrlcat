import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLang, useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { useBestScore } from "../lib/useBestScore";
import { useSwipe } from "../lib/useInput";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { useSound } from "../../components/games/SoundContext";
import { hostLabels, useHostControls, type HostControls } from "../lib/hostControls";

const SIZE = 4;
const TARGET = 2048;
const BEST_KEY = "ctrlcat-2048-best";
/** Tile slide duration. New tiles pop and merged tiles bounce once the slide lands. */
const SLIDE_MS = 110;
// Light, flat 2048 with its own ramp: white and pale blue for small values, then teal, blue,
// warm orange to red, and a gold 2048, so neighbouring values never look alike.
// Like canvas drawing constants, these are game-owned colors, the same on the site and in portal builds.
const PALETTE: Record<number, [string, string]> = {
  2: ["#FFFFFF", "#3D4A5C"],
  4: ["#E2EBF6", "#3D4A5C"],
  8: ["#7FD6C2", "#FFFFFF"],
  16: ["#3DBFA0", "#FFFFFF"],
  32: ["#3AA6D8", "#FFFFFF"],
  64: ["#2F7FD0", "#FFFFFF"],
  128: ["#F5B041", "#FFFFFF"],
  256: ["#F08C3A", "#FFFFFF"],
  512: ["#EA6B3D", "#FFFFFF"],
  1024: ["#DE4C4C", "#FFFFFF"],
  2048: ["#F2C230", "#FFFFFF"],
};
const SUPER: [string, string] = ["#2E3440", "#FFFFFF"];

const PAGE = "#F2F5F8";
const INK = "#3D4A5C";
const BOARD = "#C3CDD9";
const CELL = "#DCE3EB";
// Score boxes and buttons take their colors from the tiles: teal like the 16, orange like the 512.
const BOX = PALETTE[16][0];
const BOX_TEXT = "#FFFFFF";
const BUTTON = PALETTE[512][0];
const BUTTON_TEXT = "#FFFFFF";
const SMALL_BUTTON = CELL;
const OVERLAY_LOST = "rgba(242, 245, 248, 0.8)";
const OVERLAY_WON = "rgba(242, 194, 48, 0.55)";
const TILE_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

function swatch(value: number): [string, string] {
  return PALETTE[value] ?? SUPER;
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
    ...hostLabels.en,
    play: "Play",
    howTo: "Join the numbers and get to the 2048 tile!",
    keysHint: "Arrow keys or WASD",
    swipeHint: "Swipe to move the tiles",
    wonTitle: "You win!",
    keepPlaying: "Keep going",
    lostTitle: "Game over!",
    newBest: "New best!",
    board: "Game board",
  },
  ko: {
    ...common.ko,
    ...hostLabels.ko,
    play: "시작",
    howTo: "같은 숫자를 합쳐 2048 타일을 만드세요.",
    keysHint: "방향키 또는 WASD",
    swipeHint: "화면을 밀어서 타일을 움직이세요",
    wonTitle: "2048 달성!",
    keepPlaying: "계속하기",
    lostTitle: "게임 오버",
    newBest: "최고 기록!",
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

/** One flat tile, shared by the board and the title. */
function Block({ value, size, label }: { value: number; size: number; label?: string }) {
  const [bg, fg] = swatch(value);
  const text = label ?? String(value);
  const len = text.length;
  const fontScale = len <= 2 ? 0.5 : len === 3 ? 0.42 : len === 4 ? 0.33 : 0.26;
  return (
    <div
      className="flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(5, size * 0.12),
        background: bg,
        boxShadow: value === 2 ? "0 1px 0 rgba(61,74,92,0.12)" : undefined,
      }}
    >
      <span
        className="tabular-nums leading-none"
        style={{ fontFamily: TILE_FONT, fontWeight: 700, fontSize: size * fontScale, color: fg, letterSpacing: len >= 4 ? "-0.03em" : undefined }}
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
    inner.current.animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], {
      duration: 200,
      delay: tile.popDelay,
      easing: "ease",
      fill: "backwards",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduce || tile.mergedAt < 0 || !inner.current?.animate) return;
    inner.current.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)", offset: 0.5 }, { transform: "scale(1)" }], {
      duration: 200,
      delay: SLIDE_MS,
      easing: "ease",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.mergedAt]);

  return (
    <div
      className="absolute left-0 top-0"
      style={{
        width: cell,
        height: cell,
        transform: `translate(${x}px, ${y}px)`,
        transition: reduce ? "none" : `transform ${SLIDE_MS}ms ease-in-out`,
        zIndex: tile.ghost ? 1 : 2,
      }}
    >
      <div ref={inner} style={{ width: cell, height: cell }}>
        <Block value={shownValue} size={cell} />
      </div>
    </div>
  );
}

/** "+N" that rises out of the score box after a merge. */
function FloatUp({ amount, reduce }: { amount: number; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current?.animate) return;
    ref.current.animate(
      reduce
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: "translate(-50%, 0)", opacity: 1 },
            { transform: "translate(-50%, -48px)", opacity: 0 },
          ],
      { duration: 600, easing: "ease-in", fill: "forwards" },
    );
  }, [reduce]);
  return (
    <div
      ref={ref}
      className="absolute left-1/2 top-1/2 pointer-events-none whitespace-nowrap tabular-nums z-10"
      style={{ transform: "translate(-50%, 0)", fontFamily: TILE_FONT, fontWeight: 700, fontSize: 22, color: INK }}
    >
      +{amount}
    </div>
  );
}

function Burst({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduce || !ref.current) return;
    const colors = [2048, 1024, 512, 64, 32, 16, 8].map((v) => PALETTE[v][0]);
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
          style={{ width: 10, height: 10, borderRadius: 2, transform: "translate(-50%, -50%)", opacity: 0 }}
        />
      ))}
    </div>
  );
}

function Button({
  children,
  onClick,
  big,
  autoFocus,
}: {
  children: ReactNode;
  onClick: () => void;
  big?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="rounded-lg font-bold transition-[filter,transform] duration-100 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap"
      style={{
        fontFamily: TILE_FONT,
        fontSize: big ? 22 : 16,
        padding: big ? "12px 44px" : "0 16px",
        height: big ? undefined : "100%",
        minHeight: 40,
        background: BUTTON,
        color: BUTTON_TEXT,
        outlineColor: INK,
      }}
    >
      {children}
    </button>
  );
}

function RestartButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 flex items-center justify-center rounded-lg transition-[filter,transform] duration-100 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ width: 56, background: BUTTON, color: BUTTON_TEXT, outlineColor: INK }}
    >
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <polyline points="3 3 3 9 9 9" />
      </svg>
    </button>
  );
}

function ScoreBox({ label, children, extra }: { label: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="relative flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg px-3 py-1.5" style={{ background: BOX }}>
      <span className="text-sm font-semibold leading-tight" style={{ color: BOX_TEXT, fontFamily: TILE_FONT }}>
        {label}
      </span>
      <span className="tabular-nums leading-tight" style={{ fontFamily: TILE_FONT, fontWeight: 700, fontSize: 24, color: BOX_TEXT }}>
        {children}
      </span>
      {extra}
    </div>
  );
}

/** Sound and fullscreen, only in portal builds (the site page has its own). */
function HostButtons({ host, labels }: { host: HostControls | null; labels: typeof messages.en }) {
  if (!host) return null;
  const cls =
    "rounded-lg px-3 h-9 text-sm font-semibold whitespace-nowrap transition-[filter] hover:brightness-95 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const style = { background: SMALL_BUTTON, color: INK, outlineColor: INK, fontFamily: TILE_FONT };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={cls} style={style} onClick={host.toggleMute} aria-pressed={!host.muted}>
        {host.muted ? labels.soundOff : labels.soundOn}
      </button>
      {host.canFullscreen && (
        <button type="button" className={cls} style={style} onClick={host.toggleFullscreen}>
          {host.fullscreen ? labels.exitFullscreen : labels.fullscreen}
        </button>
      )}
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
  const digits: [string, number][] = [
    ["2", 2],
    ["0", 8],
    ["4", 64],
    ["8", 2048],
  ];
  return (
    <div ref={ref} className="flex items-end" style={{ gap: size * 0.1 }} aria-label="2048" role="img">
      {digits.map(([d, v]) => (
        <Block key={d} value={v} size={size} label={d} />
      ))}
    </div>
  );
}

export default function Game2048() {
  const m = useMessages(messages);
  const lang = useLang();
  const { play } = useSound();
  const reduce = useReducedMotion();
  const host = useHostControls();
  const [rootRef, area] = useSize();

  const [phase, setPhase] = useState<Phase>("idle");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ghosts, setGhosts] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [moveNo, setMoveNo] = useState(0);
  const [settled, setSettled] = useState(0);
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
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
      if (merges > 0) play("place");
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
      } else if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        /* Enter takes the main button of each screen; the buttons are not focused on open, so no focus ring is drawn around them. */
        if (p === "idle") {
          e.preventDefault();
          startGame();
        } else if (p === "lost" && overlayReady) {
          e.preventDefault();
          afterBreak(startGame);
        } else if (p === "won" && overlayReady) {
          e.preventDefault();
          keepGoing();
        }
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
    const logo = Math.max(48, Math.min(96, W * 0.17, H * 0.15));
    return (
      <div ref={rootRef} className="h-full w-full flex flex-col items-center justify-center px-4 py-6 text-center" style={{ background: PAGE, color: INK }}>
        <div className="flex flex-col items-center" style={{ gap: Math.min(28, H * 0.045) }}>
          <Logo size={logo} reduce={reduce} bob />
          <p className="text-base max-w-xs" style={{ fontFamily: TILE_FONT, wordBreak: "keep-all" }}>
            {m.howTo}
          </p>
          <Button onClick={startGame} big>
            {m.play}
          </Button>
          {best !== null && (
            <p className="text-base font-bold" style={{ fontFamily: TILE_FONT }}>
              {m.best} <span className="tabular-nums">{fmt(best)}</span>
            </p>
          )}
          <p className="text-sm opacity-80" style={{ fontFamily: TILE_FONT }}>
            {m.keysHint}
            <br />
            {m.swipeHint}
          </p>
          <HostButtons host={host} labels={m} />
        </div>
      </div>
    );
  }

  // Layout: score and buttons beside the board on wide stages, above it on tall ones.
  const side = W >= 560 && W > H * 1.15;
  const TOP = 16;
  const panelW = side ? Math.max(190, Math.min(240, W * 0.28)) : 0;
  const boardSize = Math.max(
    200,
    Math.floor(side ? Math.min(H - TOP - 16, W - panelW - 24 - 32, 640) : Math.min(W - 24, H - TOP - 56 - 12 - (host ? 44 : 28) - 12, 560)),
  );
  const pad = boardSize * 0.03;
  const gap = boardSize * 0.03;
  const cell = (boardSize - pad * 2 - gap * (SIZE - 1)) / SIZE;
  const at = (i: number) => pad + i * (cell + gap);
  const radius = Math.max(4, boardSize * 0.015);

  const scoreBox = (
    <ScoreBox label={m.score} extra={floats.map((f) => <FloatUp key={f.id} amount={f.amount} reduce={reduce} />)}>
      {fmt(score)}
    </ScoreBox>
  );
  const bestBox = <ScoreBox label={m.best}>{fmt(Math.max(best ?? 0, score))}</ScoreBox>;
  const title = (size: number) => (
    <h2 className="leading-none" style={{ fontFamily: TILE_FONT, fontWeight: 700, fontSize: size, color: INK }}>
      2048
    </h2>
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
      style={{ width: boardSize, height: boardSize, borderRadius: radius * 1.5, background: BOARD }}
    >
      {Array.from({ length: SIZE * SIZE }).map((_, i) => (
        <div
          key={`cell-${i}`}
          className="absolute"
          style={{ left: at(i % SIZE), top: at(Math.floor(i / SIZE)), width: cell, height: cell, borderRadius: Math.max(5, cell * 0.12), background: CELL }}
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

      {(phase === "won" || phase === "lost") && overlayReady && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center animate-fade-in"
          style={{
            background: phase === "won" ? OVERLAY_WON : OVERLAY_LOST,
            borderRadius: radius * 1.5,
            gap: boardSize * 0.04,
            padding: boardSize * 0.06,
          }}
        >
          {phase === "won" && <Burst reduce={reduce} />}
          <h2
            className="leading-tight"
            style={{ fontFamily: TILE_FONT, fontWeight: 700, fontSize: Math.max(30, boardSize * 0.12), color: phase === "won" ? BUTTON_TEXT : INK }}
          >
            {phase === "won" ? m.wonTitle : m.lostTitle}
          </h2>
          <p className="tabular-nums font-bold" style={{ fontFamily: TILE_FONT, fontSize: Math.max(16, boardSize * 0.05), color: phase === "won" ? BUTTON_TEXT : INK }}>
            {m.score} {fmt(score)}
            {newBest && <span className="block text-[0.8em]">{m.newBest}</span>}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {phase === "won" ? (
              <>
                <Button onClick={keepGoing} big>
                  {m.keepPlaying}
                </Button>
                <Button onClick={playAgain} big>
                  {m.newGame}
                </Button>
              </>
            ) : (
              <Button onClick={playAgain} big>
                {m.playAgain}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (side) {
    return (
      <div
        ref={rootRef}
        className="h-full w-full flex items-start justify-center gap-6 px-4 overflow-hidden"
        style={{ background: PAGE, paddingTop: Math.max(TOP, (H - boardSize) / 2), paddingBottom: 16 }}
      >
        <div className="flex flex-col gap-3 shrink-0" style={{ width: panelW, minHeight: boardSize }}>
          {title(Math.min(64, panelW / 3.4))}
          <div className="flex flex-col w-full gap-2" style={{ height: 132 }}>
            {scoreBox}
            {bestBox}
          </div>
          <div style={{ height: 44 }}>
            <Button onClick={startGame}>{m.newGame}</Button>
          </div>
          <HostButtons host={host} labels={m} />
          <div className="flex-1" />
          <p className="text-sm" style={{ fontFamily: TILE_FONT, color: INK }}>
            {m.howTo}
            <br />
            <span className="opacity-80">{m.keysHint}</span>
          </p>
        </div>
        {board}
      </div>
    );
  }

  // Tall stages: score, best and a restart button in one row over the board.
  return (
    <div ref={rootRef} className="h-full w-full flex flex-col items-center justify-center overflow-hidden px-3 pb-3" style={{ background: PAGE, paddingTop: TOP }}>
      <div className="flex flex-col gap-3" style={{ width: boardSize }}>
        <div className="flex items-stretch gap-2" style={{ height: 56 }}>
          {scoreBox}
          {bestBox}
          <RestartButton label={m.newGame} onClick={startGame} />
        </div>
        {board}
        <div className="flex items-center justify-between gap-2" style={{ minHeight: host ? 36 : 16 }}>
          <p className="text-xs" style={{ color: INK, fontFamily: TILE_FONT }}>
            {m.swipeHint}
          </p>
          <HostButtons host={host} labels={m} />
        </div>
      </div>
    </div>
  );
}
