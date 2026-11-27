import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLang, useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { useBestScore } from "../lib/useBestScore";
import { useSwipe } from "../lib/useInput";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { useSound } from "../../components/games/SoundContext";

const SIZE = 4;
const TARGET = 2048;
const BEST_KEY = "ctrlcat-2048-best";
/** Tile slide duration. New tiles fade in and merged tiles bump once the slide lands. */
const SLIDE_MS = 100;

// The game paints its own colors so it looks the same on the site and in portal builds.
// Like canvas drawing constants, these are game-owned values, not site theme colors.
// Flat tiles on a stone-gray board. Small values stay pale, then the ramp goes yellow, orange, red,
// and turns to green and blue past 128 so neighbouring values never look alike.
const PAGE = "#f4f3ef";
const INK = "#2b2a27";
const INK_DIM = "#6b6862";
const BOARD = "#8f8a80";
const CELL_EMPTY = "#a6a196";
const BUTTON = "#2b2a27";
const BUTTON_TEXT = "#ffffff";
const LINE = "#d6d3cb";
const TILE_COLORS: Record<number, [string, string]> = {
  2: ["#fbfaf7", "#3d3a35"],
  4: ["#f1ead8", "#3d3a35"],
  8: ["#f6c95b", "#3d2a00"],
  16: ["#f29e3d", "#ffffff"],
  32: ["#e8693a", "#ffffff"],
  64: ["#cf3e2f", "#ffffff"],
  128: ["#7bbf6a", "#ffffff"],
  256: ["#3f9a63", "#ffffff"],
  512: ["#2f8a9c", "#ffffff"],
  1024: ["#2f629c", "#ffffff"],
  2048: ["#1f3866", "#ffffff"],
};
const TILE_HIGH: [string, string] = ["#1b1b1b", "#ffffff"];
const FONT = 'Arial, "Helvetica Neue", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

function tileColor(value: number) {
  return TILE_COLORS[value] ?? TILE_HIGH;
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
    title: "2048",
    hint: "Arrow keys or WASD. On a touch screen, swipe.",
    wonTitle: "You made 2048",
    keepPlaying: "Keep going",
    lostTitle: "No moves left",
    finalScore: (n: string) => `Score ${n}`,
    newBest: "That is a new best.",
    board: "Game board",
  },
  ko: {
    ...common.ko,
    title: "2048",
    hint: "방향키나 WASD로 움직입니다. 터치 화면에서는 손가락으로 밀어 주세요.",
    wonTitle: "2048을 만들었습니다",
    keepPlaying: "이어서 하기",
    lostTitle: "더 움직일 수 없습니다",
    finalScore: (n: string) => `점수 ${n}`,
    newBest: "최고 기록입니다.",
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

function TileFace({ value, size }: { value: number; size: number }) {
  const [bg, fg] = tileColor(value);
  const text = String(value);
  const len = text.length;
  const fontScale = len <= 2 ? 0.46 : len === 3 ? 0.38 : len === 4 ? 0.3 : 0.24;
  return (
    <div
      className="flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: bg,
        color: fg,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size * fontScale,
        lineHeight: 1,
        letterSpacing: len >= 4 ? "-0.03em" : undefined,
      }}
    >
      <span className="tabular-nums">{text}</span>
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
    inner.current.animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }], {
      duration: 120,
      delay: tile.popDelay,
      easing: "ease-out",
      fill: "backwards",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduce || tile.mergedAt < 0 || !inner.current?.animate) return;
    inner.current.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)", offset: 0.5 }, { transform: "scale(1)" }], {
      duration: 140,
      delay: SLIDE_MS,
      easing: "ease-out",
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
        <TileFace value={shownValue} size={cell} />
      </div>
    </div>
  );
}

function TextButton({ children, onClick, primary, autoFocus }: { children: string; onClick: () => void; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="h-9 px-4 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px"
      style={{
        fontFamily: FONT,
        borderRadius: 3,
        background: primary ? BUTTON : "transparent",
        color: primary ? BUTTON_TEXT : INK,
        border: `1px solid ${BUTTON}`,
      }}
    >
      {children}
    </button>
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
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null);
  const [overlayReady, setOverlayReady] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const { best, record } = useBestScore(BEST_KEY);
  usePhaseEvents(phase, { score });

  // Authoritative game state, updated synchronously so fast key repeats never act on a stale board.
  const game = useRef({ tiles: [] as Tile[], score: 0, phase: "idle" as Phase, keepPlaying: false, moveNo: 0, bestAtStart: 0 });
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
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
        popDelay: delay,
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
    const fresh = spawn([], 2, 0, 0);
    game.current = { tiles: fresh, score: 0, phase: "playing", keepPlaying: false, moveNo: 0, bestAtStart: best ?? 0 };
    setTiles(fresh);
    setGhosts([]);
    setScore(0);
    setMoveNo(0);
    setSettled(0);
    setGain(null);
    setOverlayReady(false);
    setNewBest(false);
    setPhase("playing");
  }, [spawn, best]);

  // Like most 2048 games, the board is ready the moment the page opens: no title screen.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startGame();
  }, [startGame]);
  // The saved best loads after the first board is dealt.
  useEffect(() => {
    if (best !== null && game.current.moveNo === 0) game.current.bestAtStart = best;
  }, [best]);

  const move = useCallback(
    (dir: Dir) => {
      const g = game.current;
      if (g.phase !== "playing") return;
      const id = g.moveNo + 1;
      const { tiles: moved, ghosts: gone, gained, merges, changed } = slide(g.tiles, dir, id);
      if (!changed) return;
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
        setGain({ id, amount: gained });
      }

      const highest = withNew.reduce((mx, t) => Math.max(mx, t.value), 0);
      if (!g.keepPlaying && highest >= TARGET) {
        play("win");
        setGamePhase("won");
        later(() => setOverlayReady(true), slideMs + 250);
        return;
      }
      if (merges > 0) play("place");

      if (!hasMoves(withNew)) {
        setGamePhase("lost");
        later(() => play("lose"), slideMs + 150);
        later(() => setOverlayReady(true), slideMs + 500);
      }
    },
    [spawn, record, play, reduce],
  );

  const keepGoing = () => {
    game.current.keepPlaying = true;
    setOverlayReady(false);
    setGamePhase("playing");
  };
  const playAgain = () => afterBreak(startGame);
  const newGame = () => {
    if (game.current.phase === "playing" && game.current.moveNo > 0) afterBreak(startGame);
    else startGame();
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

  // One column: title, a score line with the new game button, the board, and a one-line hint.
  // The top 56px stay clear on the right for the portal's mute and fullscreen buttons.
  const HEAD = 56;
  const SCORE_ROW = 44;
  const FOOT = 34;
  const boardSize = Math.max(200, Math.floor(Math.min(W - 24, H - HEAD - SCORE_ROW - FOOT - 16, 520)));
  const pad = Math.round(boardSize * 0.025);
  const gap = Math.round(boardSize * 0.025);
  const cell = (boardSize - pad * 2 - gap * (SIZE - 1)) / SIZE;
  const at = (i: number) => pad + i * (cell + gap);
  const shownBest = best !== null ? Math.max(best, score) : score;
  const ended = (phase === "won" || phase === "lost") && overlayReady;

  return (
    <div ref={rootRef} className="h-full w-full overflow-hidden" style={{ background: PAGE, color: INK, fontFamily: FONT }}>
      {W > 0 && (
        <div className="mx-auto flex h-full flex-col px-3" style={{ width: boardSize + 24 }}>
          <div className="flex shrink-0 items-end" style={{ height: HEAD, paddingBottom: 4 }}>
            <h1 className="text-[34px] font-bold leading-none tracking-tight">{m.title}</h1>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t" style={{ height: SCORE_ROW, borderColor: LINE }}>
            <p className="text-sm tabular-nums" aria-live="polite">
              <span style={{ color: INK_DIM }}>{m.score}</span> <b className="text-base">{fmt(score)}</b>
              <span aria-hidden="true" className="inline-block w-12 pl-1.5 text-xs font-bold" style={{ color: INK_DIM }}>
                {gain && !reduce && (
                  <span key={gain.id} className="animate-fade-in">
                    +{gain.amount}
                  </span>
                )}
              </span>
              <span style={{ color: INK_DIM }}>{m.best}</span> <b className="text-base">{fmt(shownBest)}</b>
            </p>
            <TextButton onClick={newGame} primary>
              {m.newGame}
            </TextButton>
          </div>
          <div
            role="group"
            aria-label={m.board}
            className="relative shrink-0 select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={() => (drag.current = null)}
            style={{ width: boardSize, height: boardSize, borderRadius: 4, background: BOARD }}
          >
            {Array.from({ length: SIZE * SIZE }).map((_, i) => (
              <div
                key={`cell-${i}`}
                className="absolute"
                style={{ left: at(i % SIZE), top: at(Math.floor(i / SIZE)), width: cell, height: cell, borderRadius: 3, background: CELL_EMPTY }}
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

            {ended && (
              <div
                className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 text-center animate-fade-in"
                style={{ background: "rgba(244, 243, 239, 0.74)", borderRadius: 4, padding: 16 }}
              >
                <h2 className="text-2xl font-bold">{phase === "won" ? m.wonTitle : m.lostTitle}</h2>
                <p className="text-base tabular-nums">{m.finalScore(fmt(score))}</p>
                {newBest && <p className="text-sm" style={{ color: INK_DIM }}>{m.newBest}</p>}
                <div className="mt-1 flex gap-2">
                  {phase === "won" ? (
                    <>
                      <TextButton onClick={keepGoing} primary autoFocus>
                        {m.keepPlaying}
                      </TextButton>
                      <TextButton onClick={playAgain}>{m.newGame}</TextButton>
                    </>
                  ) : (
                    <TextButton onClick={playAgain} primary autoFocus>
                      {m.playAgain}
                    </TextButton>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="shrink-0 pt-2 text-xs leading-snug" style={{ color: INK_DIM, minHeight: FOOT }}>
            {m.hint}
          </p>
        </div>
      )}
    </div>
  );
}
