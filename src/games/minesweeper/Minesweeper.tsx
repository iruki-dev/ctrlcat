import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type CellState = "hidden" | "revealed" | "flagged";
type Phase = "idle" | "playing" | "won" | "lost";

interface Cell {
  mine: boolean;
  adj: number;
  state: CellState;
}

interface Level {
  label: string;
  size: number;
  mines: number;
  cols: string;
  text: string;
}

const LEVELS: Level[] = [
  { label: "Easy", size: 8, mines: 10, cols: "grid-cols-8", text: "text-[0.625rem] sm:text-base" },
  { label: "Medium", size: 10, mines: 18, cols: "grid-cols-10", text: "text-[0.625rem] sm:text-sm" },
  { label: "Hard", size: 12, mines: 30, cols: "grid-cols-12", text: "text-[0.5rem] sm:text-xs" },
];

const NUMBER_COLOR = [
  "",
  "text-blue-600 dark:text-blue-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-rose-600 dark:text-rose-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-amber-600 dark:text-amber-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-slate-600 dark:text-slate-300",
];

function emptyBoard(size: number): Cell[] {
  return Array.from({ length: size * size }, () => ({
    mine: false,
    adj: 0,
    state: "hidden" as CellState,
  }));
}

function neighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      out.push(r * size + c);
    }
  }
  return out;
}

function plantMines(board: Cell[], size: number, mines: number, safe: number): Cell[] {
  const next = board.map((cell) => ({ ...cell }));
  const forbidden = new Set<number>([safe, ...neighbors(safe, size)]);
  const pool: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    if (!forbidden.has(i)) pool.push(i);
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const count = Math.min(mines, pool.length);
  for (let i = 0; i < count; i += 1) next[pool[i]].mine = true;
  for (let i = 0; i < next.length; i += 1) {
    next[i].adj = neighbors(i, size).filter((n) => next[n].mine).length;
  }
  return next;
}

function floodReveal(board: Cell[], size: number, start: number): Cell[] {
  const next = board.map((cell) => ({ ...cell }));
  const stack = [start];
  while (stack.length > 0) {
    const index = stack.pop() as number;
    const cell = next[index];
    if (cell.state !== "hidden") continue;
    cell.state = "revealed";
    if (cell.adj === 0 && !cell.mine) {
      for (const n of neighbors(index, size)) {
        if (next[n].state === "hidden") stack.push(n);
      }
    }
  }
  return next;
}

function revealTargets(board: Cell[], size: number, targets: number[]): Cell[] {
  let next = board;
  for (const target of targets) {
    if (next[target].state !== "hidden") continue;
    if (next[target].mine) {
      next = next.map((cell, i) =>
        i === target ? { ...cell, state: "revealed" as CellState } : cell,
      );
    } else {
      next = floodReveal(next, size, target);
    }
  }
  return next;
}

function isCleared(board: Cell[]): boolean {
  return board.every((cell) => cell.mine || cell.state === "revealed");
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function MineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" aria-hidden="true">
      <circle cx="12" cy="12" r="5.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v3.5M12 18v3.5M2.5 12h3.5M18 12h3.5M5.5 5.5l2.4 2.4M16.1 16.1l2.4 2.4M18.5 5.5l-2.4 2.4M7.9 16.1l-2.4 2.4" />
      </g>
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" aria-hidden="true">
      <path d="M6.5 3.5v17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M8 4.5h10l-3 3.75L18 12H8z" fill="currentColor" />
    </svg>
  );
}

export default function Minesweeper() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<Cell[]>(() => emptyBoard(LEVELS[0].size));
  const [planted, setPlanted] = useState(false);
  const [time, setTime] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [exploded, setExploded] = useState<number | null>(null);
  const [best, setBest] = useState<(number | null)[]>([null, null, null]);

  const level = LEVELS[levelIndex];
  const boardRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const flagged = board.filter((cell) => cell.state === "flagged").length;
  const minesLeft = level.mines - flagged;

  useEffect(() => {
    if (phase !== "playing" || !planted) return;
    const id = window.setInterval(() => setTime((t) => Math.min(t + 1, 5999)), 1000);
    return () => window.clearInterval(id);
  }, [phase, planted]);

  const startGame = useCallback(
    (index: number) => {
      setLevelIndex(index);
      setBoard(emptyBoard(LEVELS[index].size));
      setPlanted(false);
      setPhase("playing");
      setTime(0);
      setCursor(0);
      setExploded(null);
      setFlagMode(false);
    },
    [],
  );

  const finish = useCallback(
    (next: Cell[], hitIndex: number | null) => {
      if (hitIndex !== null) {
        setExploded(hitIndex);
        setBoard(
          next.map((cell) =>
            cell.mine && cell.state !== "flagged"
              ? { ...cell, state: "revealed" as CellState }
              : cell,
          ),
        );
        setPhase("lost");
        return true;
      }
      if (isCleared(next)) {
        setBoard(
          next.map((cell) =>
            cell.mine ? { ...cell, state: "flagged" as CellState } : cell,
          ),
        );
        setPhase("won");
        setBest((prev) => {
          const copy = [...prev];
          const current = copy[levelIndex];
          if (current === null || time < current) copy[levelIndex] = time;
          return copy;
        });
        return true;
      }
      setBoard(next);
      return false;
    },
    [levelIndex, time],
  );

  const reveal = useCallback(
    (index: number) => {
      if (phase !== "playing") return;
      const cell = board[index];
      if (cell.state === "flagged") return;

      let working = board;
      let targets: number[] = [index];

      if (cell.state === "revealed") {
        if (cell.adj === 0) return;
        const around = neighbors(index, level.size);
        const marked = around.filter((n) => working[n].state === "flagged").length;
        if (marked !== cell.adj) return;
        targets = around.filter((n) => working[n].state === "hidden");
        if (targets.length === 0) return;
      } else if (!planted) {
        working = plantMines(working, level.size, level.mines, index);
        setPlanted(true);
      }

      const next = revealTargets(working, level.size, targets);
      const hit = targets.find((t) => next[t].mine && next[t].state === "revealed");
      finish(next, hit === undefined ? null : hit);
    },
    [board, finish, level.mines, level.size, phase, planted],
  );

  const toggleFlag = useCallback(
    (index: number) => {
      if (phase !== "playing") return;
      setBoard((prev) => {
        const cell = prev[index];
        if (cell.state === "revealed") return prev;
        const next = [...prev];
        next[index] = {
          ...cell,
          state: cell.state === "flagged" ? "hidden" : "flagged",
        };
        return next;
      });
    },
    [phase],
  );

  const clearPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (index: number, button: number) => {
      if (button !== 0) return;
      setCursor(index);
      longPressed.current = false;
      clearPress();
      pressTimer.current = window.setTimeout(() => {
        longPressed.current = true;
        pressTimer.current = null;
        toggleFlag(index);
      }, 420);
    },
    [clearPress, toggleFlag],
  );

  const handlePointerUp = useCallback(
    (index: number, button: number) => {
      if (button !== 0) return;
      clearPress();
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      if (flagMode) toggleFlag(index);
      else reveal(index);
    },
    [clearPress, flagMode, reveal, toggleFlag],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (phase !== "playing") return;
      const size = level.size;
      const row = Math.floor(cursor / size);
      const col = cursor % size;
      const key = event.key;
      let handled = true;

      if (key === "ArrowUp" || key === "w") setCursor(((row + size - 1) % size) * size + col);
      else if (key === "ArrowDown" || key === "s") setCursor(((row + 1) % size) * size + col);
      else if (key === "ArrowLeft" || key === "a") setCursor(row * size + ((col + size - 1) % size));
      else if (key === "ArrowRight" || key === "d") setCursor(row * size + ((col + 1) % size));
      else if (key === "Enter" || key === " ") reveal(cursor);
      else if (key === "f" || key === "F") toggleFlag(cursor);
      else handled = false;

      if (handled) event.preventDefault();
    },
    [cursor, level.size, phase, reveal, toggleFlag],
  );

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Clear every safe tile without setting off a mine. Each number tells you how many
            mines touch that tile.
          </p>
          <p className="text-game-text-dim text-sm">
            Click to reveal, right-click or long-press to flag. Your first tile is always safe.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <span className="text-xs uppercase tracking-wide text-game-text-dim">Board size</span>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setLevelIndex(index)}
                className={`rounded-2xl border-2 px-3 py-3 transition-all duration-200 ${
                  index === levelIndex
                    ? "border-game-accent bg-game-accent-light text-game-accent font-semibold"
                    : "border-game-border bg-game-surface text-game-text-dim hover:border-game-accent"
                }`}
              >
                <span className="block text-sm">{item.label}</span>
                <span className="block text-xs opacity-70">
                  {item.size} x {item.size} · {item.mines}
                </span>
              </button>
            ))}
          </div>
        </div>
        <GameButton onClick={() => startGame(levelIndex)} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  const bestTime = best[levelIndex];
  const over = phase === "won" || phase === "lost";

  return (
    <div className="max-w-md mx-auto flex flex-col gap-3 animate-fade-in">
      <div className="grid grid-cols-3 gap-2">
        <ScoreDisplay label="Mines" value={minesLeft} size="sm" highlight />
        <ScoreDisplay label="Time" value={formatTime(time)} size="sm" />
        <ScoreDisplay label="Best" value={bestTime === null ? "—" : formatTime(bestTime)} size="sm" />
      </div>

      {over && (
        <div className="animate-slide-up">
          <GameMessage type={phase === "won" ? "success" : "error"}>
            {phase === "won"
              ? `Board cleared in ${formatTime(time)}.`
              : "You hit a mine. Board revealed."}
          </GameMessage>
        </div>
      )}

      <div className="flex justify-center">
      <div
        ref={boardRef}
        tabIndex={0}
        role="grid"
        aria-label={`Minesweeper board, ${level.size} by ${level.size}`}
        onKeyDown={handleKeyDown}
        className={`grid ${level.cols} gap-1 p-1.5 w-full max-w-[min(100%,calc(75svh_-_11rem),calc(85svw_-_11rem))] rounded-2xl bg-game-surface border-2 border-game-border select-none touch-manipulation focus:outline-none focus:ring-2 focus:ring-game-accent`}
      >
        {board.map((cell, index) => {
          const isCursor = index === cursor && phase === "playing";
          const revealedMine = cell.state === "revealed" && cell.mine;
          const base =
            "relative aspect-square rounded-sm sm:rounded-md flex items-center justify-center transition-colors duration-150 border";
          let look: string;
          if (cell.state === "revealed") {
            look = revealedMine
              ? index === exploded
                ? "bg-red-500 border-red-600 text-white"
                : "bg-red-100 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
              : "bg-game-bg border-game-border text-game-text";
          } else if (cell.state === "flagged") {
            look = "bg-game-accent-light border-game-accent text-game-secondary";
          } else {
            look =
              "bg-game-accent-light border-game-border hover:bg-game-accent/20 active:bg-game-accent/25";
          }
          const ring = isCursor ? "ring-2 ring-game-accent ring-offset-1 z-10" : "";
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              disabled={over}
              aria-label={
                cell.state === "flagged"
                  ? "Flagged tile"
                  : cell.state === "hidden"
                    ? "Hidden tile"
                    : cell.mine
                      ? "Mine"
                      : `${cell.adj} neighbouring mines`
              }
              onPointerDown={(event) => handlePointerDown(index, event.button)}
              onPointerUp={(event) => handlePointerUp(index, event.button)}
              onPointerLeave={clearPress}
              onPointerCancel={clearPress}
              onContextMenu={(event) => {
                event.preventDefault();
                clearPress();
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                toggleFlag(index);
              }}
              className={`${base} ${look} ${ring} ${level.text} font-bold leading-none disabled:cursor-default`}
            >
              {cell.state === "flagged" && <FlagIcon />}
              {revealedMine && <MineIcon />}
              {cell.state === "revealed" && !cell.mine && cell.adj > 0 && (
                <span className={NUMBER_COLOR[cell.adj]}>{cell.adj}</span>
              )}
            </button>
          );
        })}
      </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!over && (
          <GameButton
            variant={flagMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFlagMode((f) => !f)}
          >
            Flag mode
          </GameButton>
        )}
        <GameButton variant="secondary" size="sm" onClick={() => startGame(levelIndex)}>
          {over ? "Play again" : "Restart"}
        </GameButton>
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          Level
        </GameButton>
      </div>

      <p className="text-center text-[11px] leading-tight text-game-text-dim">
        Arrow keys move · Enter reveals · F, right-click or long-press flags
      </p>
    </div>
  );
}
