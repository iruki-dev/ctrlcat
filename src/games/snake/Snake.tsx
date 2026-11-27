import { useRef, useState, useCallback, useEffect, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
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
const START_GRACE = 0.4;
const RESUME_GRACE = 0.35;
const SWIPE_PX = 22;
const DEMO_MAX_LEN = 14;
/** After a crash the snake blinks for this long before the result box opens. */
const BLINK_TIME = 1.1;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Status = "idle" | "playing" | "paused" | "dead" | "won";
type Difficulty = "easy" | "normal" | "hard" | "insane";

const DIRS: Dir[] = ["up", "down", "left", "right"];
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const DELTA: Record<Dir, Point> = {
  right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
};

const DIFF: Record<Difficulty, { baseMs: number; minMs: number }> = {
  easy: { baseMs: 240, minMs: 110 },
  normal: { baseMs: 150, minMs: 65 },
  hard: { baseMs: 90, minMs: 40 },
  insane: { baseMs: 55, minMs: 22 },
};

/* A monochrome LCD, like the snake on old mobile phones: one dark ink on an olive screen.
   Canvas and inline styles cannot read Tailwind tokens, so the game keeps its own constants. */
const LCD = "#c2cc9f";
const INK = "#26301c";
const INK_SOFT = "#4f5c3c";
const PIXEL_GRID = "rgba(38, 48, 28, 0.04)";
const FONT = "Arial, 'Helvetica Neue', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

/* ---------------------------------------------------------------- messages */

const messages = {
  en: {
    ...common.en,
    title: "Snake",
    levelLabel: "Level",
    levels: { easy: "Easy", normal: "Normal", hard: "Hard", insane: "Very hard" } as Record<Difficulty, string>,
    controlsKeys: "Steer with the arrow keys or WASD. Space pauses.",
    controlsTouch: "Swipe in any direction to steer.",
    gameOver: "Game over",
    cleared: "Board filled",
    newBest: "New best score.",
    menu: "Menu",
    paused: "Paused",
  },
  ko: {
    ...common.ko,
    title: "스네이크",
    levelLabel: "레벨",
    levels: { easy: "쉬움", normal: "보통", hard: "어려움", insane: "아주 어려움" } as Record<Difficulty, string>,
    controlsKeys: "방향키나 WASD로 방향을 바꿉니다. Space를 누르면 멈춥니다.",
    controlsTouch: "화면을 가고 싶은 쪽으로 밀면 방향이 바뀝니다.",
    gameOver: "게임 오버",
    cleared: "판을 다 채웠습니다",
    newBest: "최고 점수를 새로 세웠습니다.",
    menu: "메뉴",
    paused: "일시 정지",
  },
};

/* ---------------------------------------------------------------- state */

interface GameState {
  status: Status;
  demo: boolean;
  cols: number; rows: number;
  snake: Point[];
  dir: Dir; queue: Dir[];
  food: Point;
  score: number;
  accum: number; interval: number; grace: number;
  time: number;
  deathT: number; overShown: boolean;
  difficulty: Difficulty;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

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
    snake,
    dir: "right", queue: [],
    food: { x: 0, y: 0 },
    score: 0,
    accum: 0, interval: intervalFor(0, difficulty), grace: demo ? 0 : START_GRACE,
    time: 0,
    deathT: 0, overShown: false,
    difficulty,
  };
  s.food = randomFood(s) ?? { x: 0, y: 0 };
  return s;
}

/** One grid step. Returns what happened. */
function step(s: GameState): "move" | "eat" | "die" {
  if (s.queue.length) s.dir = s.queue.shift()!;
  const d = DELTA[s.dir];
  const h = s.snake[0];
  const head = { x: h.x + d.x, y: h.y + d.y };
  const hitWall = head.x < 0 || head.x >= s.cols || head.y < 0 || head.y >= s.rows;
  // The tail cell frees up this same step, so it does not count as a collision.
  const hitSelf = s.snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y);
  if (hitWall || hitSelf) return "die";
  s.snake.unshift(head);
  if (head.x === s.food.x && head.y === s.food.y) return "eat";
  s.snake.pop();
  return "move";
}

/** Attract-mode steering: head for the food, avoid walls, the body, and dead-end pockets. */
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

/* ---------------------------------------------------------------- drawing */

/** A segment is a square pixel block with a thin gap, so the body reads as a row of LCD dots. */
function drawSnake(ctx: CanvasRenderingContext2D, s: GameState) {
  const g = 3;
  ctx.fillStyle = INK;
  s.snake.forEach((p, i) => {
    const x = p.x * CELL, y = p.y * CELL;
    ctx.fillRect(x + g, y + g, CELL - g * 2, CELL - g * 2);
    // Fill the gap toward the next segment so the body is one continuous line.
    const next = s.snake[i + 1];
    if (next) {
      const dx = next.x - p.x, dy = next.y - p.y;
      if (dx === 1) ctx.fillRect(x + CELL - g, y + g, g * 2, CELL - g * 2);
      if (dx === -1) ctx.fillRect(x - g, y + g, g * 2, CELL - g * 2);
      if (dy === 1) ctx.fillRect(x + g, y + CELL - g, CELL - g * 2, g * 2);
      if (dy === -1) ctx.fillRect(x + g, y - g, CELL - g * 2, g * 2);
    }
  });
  // An eye on the head, set toward the direction of travel.
  const h = s.snake[0];
  const d = DELTA[s.dir];
  const e = 6;
  const cx = h.x * CELL + CELL / 2 + d.x * 5 + d.y * 5;
  const cy = h.y * CELL + CELL / 2 + d.y * 5 - d.x * 5;
  ctx.fillStyle = LCD;
  ctx.fillRect(cx - e / 2, cy - e / 2, e, e);
}

/** Food is four small blocks in a diamond, like the dot snake used to chase. */
function drawFood(ctx: CanvasRenderingContext2D, p: Point) {
  const u = 8;
  const x = p.x * CELL + CELL / 2, y = p.y * CELL + CELL / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(x - u / 2, y - u * 1.5, u, u);
  ctx.fillRect(x - u * 1.5, y - u / 2, u, u);
  ctx.fillRect(x + u / 2, y - u / 2, u, u);
  ctx.fillRect(x - u / 2, y + u / 2, u, u);
}

/* ---------------------------------------------------------------- small UI pieces */

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true"><rect x="6" y="5" width="4" height="14" fill="currentColor" /><rect x="14" y="5" width="4" height="14" fill="currentColor" /></svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true"><path d="M7 5v14l12-7z" fill="currentColor" /></svg>
);

/** A box drawn on the LCD: dark frame, a dark title strip with light text, then plain rows. */
function LcdBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[17rem]" style={{ background: LCD, border: `2px solid ${INK}`, color: INK }}>
      <h2 className="px-3 py-1.5 text-base font-bold" style={{ background: INK, color: LCD }}>{title}</h2>
      <div className="flex flex-col gap-3 px-3 py-3 text-sm">{children}</div>
    </div>
  );
}

function LcdButton({ onClick, children, primary, autoFocus }: { onClick: () => void; children: ReactNode; primary?: boolean; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="h-10 w-full px-3 text-left text-base font-bold focus:outline-none focus-visible:outline-dashed focus-visible:outline-1 focus-visible:outline-current focus-visible:-outline-offset-4 active:translate-y-px"
      style={{ background: primary ? INK : "transparent", color: primary ? LCD : INK, border: `2px solid ${INK}` }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- component */

export default function Snake() {
  const m = useMessages(messages);

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
  const [dims, setDims] = useState({ cols: 20, rows: 16 });
  const [touchUi, setTouchUi] = useState(false);
  usePhaseEvents(uiStatus, { playing: "playing", paused: ["paused"], won: ["won"], lost: ["dead"], score: uiScore });

  const { best, record } = useBestScore(`ctrlcat:snake:best:${difficulty}`);
  const recordRef = useRef(record);
  recordRef.current = record;

  const { play } = useSound();
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    setTouchUi(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  const g = useRef<GameState>(newState(20, 16, "normal", true));

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
    g.current = newState(d.cols, d.rows, difficulty, false);
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
        if ((e.target as HTMLElement)?.tagName === "BUTTON" && s.status === "idle") return;
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
      s.time += dt;

      if (s.status === "dead" || s.status === "won") {
        s.deathT += dt;
        const showAt = s.status === "dead" ? BLINK_TIME : 0.6;
        if (!s.overShown && s.deathT >= showAt) { s.overShown = true; setUiOver(true); }
        return;
      }
      if (s.status === "paused") return;

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
        s.deathT = 0;
        playRef.current("die");
        const isBest = recordRef.current(s.score);
        setUiNewBest(isBest);
        setUiStatus("dead");
        return;
      }

      if (res === "eat") {
        if (s.demo) {
          if (s.snake.length > DEMO_MAX_LEN) s.snake.pop();
        } else {
          s.score += 1;
          setUiScore(s.score);
          playRef.current("eat");
          s.interval = intervalFor(s.score, s.difficulty);
        }
        const next = randomFood(s);
        if (!next) {
          // Every cell is snake: the board is filled.
          s.status = "won";
          s.deathT = 0;
          setUiNewBest(recordRef.current(s.score));
          playRef.current("win");
          setUiStatus("won");
          return;
        }
        s.food = next;
      }
    },

    draw(ctx, w, h) {
      const s = g.current;
      ctx.fillStyle = LCD;
      ctx.fillRect(0, 0, w, h);
      // Faint pixel grid, like the unlit dots of an LCD.
      ctx.fillStyle = PIXEL_GRID;
      for (let x = 0; x < s.cols; x++) {
        for (let y = 0; y < s.rows; y++) ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
      }
      if (s.status !== "won") drawFood(ctx, s.food);
      // After a crash the snake blinks a few times.
      const hidden = s.status === "dead" && s.deathT < BLINK_TIME && Math.floor(s.deathT / 0.16) % 2 === 1;
      if (!hidden) drawSnake(ctx, s);
    },
  }, true);

  /* Board size in CSS pixels: whole cells, as large as the area allows (the 2px frame sits outside). */
  const cellPx = area.w && area.h ? Math.min((area.w - 4) / dims.cols, (area.h - 4) / dims.rows) : 0;
  const boardW = Math.floor(cellPx * dims.cols);
  const boardH = Math.floor(cellPx * dims.rows);
  const W = dims.cols * CELL;
  const H = dims.rows * CELL;

  const shownBest = Math.max(best ?? 0, uiStatus === "playing" || uiStatus === "paused" ? uiScore : 0);
  const inRound = uiStatus === "playing" || uiStatus === "paused";
  const ended = (uiStatus === "dead" || uiStatus === "won") && uiOver;
  const pad4 = (n: number) => String(n).padStart(4, "0");

  return (
    <div
      className="w-full h-full flex flex-col touch-none select-none"
      style={{ background: LCD, color: INK, fontFamily: FONT }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { touch.current = null; }}
    >
      {/* Score line: kept clear on the right where portal builds put their mute and fullscreen buttons. */}
      <div className="shrink-0 h-14 flex items-center gap-3 pl-3 pr-28">
        {inRound && (
          <button
            type="button"
            onClick={() => (uiStatus === "paused" ? resume() : pause())}
            aria-label={uiStatus === "paused" ? m.resume : m.pause}
            title={uiStatus === "paused" ? m.resume : m.pause}
            className="w-9 h-9 shrink-0 flex items-center justify-center"
            style={{ border: `2px solid ${INK}`, color: INK }}
          >
            {uiStatus === "paused" ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}
        <p className="flex items-baseline gap-4 tabular-nums" style={{ fontFamily: MONO }}>
          <span className="text-3xl font-bold leading-none" aria-label={`${m.score} ${uiScore}`}>{pad4(uiScore)}</span>
          <span className="text-sm" style={{ color: INK_SOFT, fontFamily: FONT }}>
            {m.best} <span style={{ fontFamily: MONO }}>{pad4(shownBest)}</span>
          </span>
        </p>
      </div>

      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center px-3 pb-3">
        <div
          className="relative overflow-hidden"
          style={{ width: boardW ? boardW + 4 : undefined, height: boardH ? boardH + 4 : undefined, border: `2px solid ${INK}` }}
        >
          <GameCanvas ref={canvasRef} width={W} height={H} cssWidth={boardW} cssHeight={boardH} className="block" />

          {/* Menu over the attract-mode board */}
          {uiStatus === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <LcdBox title={m.title}>
                <LcdButton onClick={start} primary autoFocus>{m.newGame}</LcdButton>
                <div role="radiogroup" aria-label={m.levelLabel}>
                  <p className="mb-1" style={{ color: INK_SOFT }}>{m.levelLabel}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(DIFF) as Difficulty[]).map(key => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={difficulty === key}
                        onClick={() => setDifficulty(key)}
                        className="h-8 px-2 text-left text-sm font-bold"
                        style={{
                          border: `1px solid ${INK}`,
                          background: difficulty === key ? INK : "transparent",
                          color: difficulty === key ? LCD : INK,
                        }}
                      >
                        {m.levels[key]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="flex justify-between border-t pt-2" style={{ borderColor: INK_SOFT }}>
                  <span>{m.best}</span>
                  <b className="tabular-nums" style={{ fontFamily: MONO }}>{pad4(best ?? 0)}</b>
                </p>
                <p className="text-xs leading-snug" style={{ color: INK_SOFT }}>{touchUi ? m.controlsTouch : m.controlsKeys}</p>
              </LcdBox>
            </div>
          )}

          {/* Pause */}
          {uiStatus === "paused" && (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <LcdBox title={m.paused}>
                <LcdButton onClick={resume} primary autoFocus>{m.resume}</LcdButton>
                <LcdButton onClick={toMenu}>{m.menu}</LcdButton>
              </LcdBox>
            </div>
          )}

          {/* Game over */}
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <LcdBox title={uiStatus === "won" ? m.cleared : m.gameOver}>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <th scope="row" className="py-0.5 text-left font-normal">{m.score}</th>
                      <td className="py-0.5 text-right text-lg font-bold tabular-nums" style={{ fontFamily: MONO }}>{pad4(uiScore)}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-0.5 text-left font-normal">{m.best}</th>
                      <td className="py-0.5 text-right tabular-nums" style={{ fontFamily: MONO }}>{pad4(best ?? 0)}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="py-0.5 text-left font-normal">{m.levelLabel}</th>
                      <td className="py-0.5 text-right">{m.levels[difficulty]}</td>
                    </tr>
                  </tbody>
                </table>
                {uiNewBest && <p className="font-bold">{m.newBest}</p>}
                <LcdButton onClick={() => afterBreak(start)} primary autoFocus>{m.playAgain}</LcdButton>
                <LcdButton onClick={toMenu}>{m.menu}</LcdButton>
              </LcdBox>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
