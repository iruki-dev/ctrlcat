import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";
import { useSwipe } from "../lib/useInput";

const SIZE = 4;
const TARGET = 2048;
const BEST_KEY = "ctrlcat-2048-best";

type Dir = "up" | "down" | "left" | "right";
type Phase = "idle" | "playing" | "won" | "lost";

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew: boolean;
  merged: boolean;
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
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array<Tile | null>(SIZE).fill(null)
  );
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

/** Slides and merges every line toward `dir`. Returns a fresh tile list. */
function slide(tiles: Tile[], dir: Dir) {
  const next = tiles.map((t) => ({ ...t, isNew: false, merged: false }));
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () =>
    Array<Tile | null>(SIZE).fill(null)
  );
  next.forEach((t) => {
    grid[t.row][t.col] = t;
  });

  const result: Tile[] = [];
  let gained = 0;
  let changed = false;

  for (let line = 0; line < SIZE; line++) {
    const queue: Tile[] = [];
    for (let i = 0; i < SIZE; i++) {
      const p = cellAt(line, i, dir);
      const t = grid[p.row][p.col];
      if (t) queue.push(t);
    }

    const packed: Tile[] = [];
    let i = 0;
    while (i < queue.length) {
      const a = queue[i];
      const b = queue[i + 1];
      if (b && b.value === a.value) {
        a.value *= 2;
        a.merged = true;
        gained += a.value;
        changed = true;
        packed.push(a);
        i += 2;
      } else {
        packed.push(a);
        i += 1;
      }
    }

    packed.forEach((t, idx) => {
      const p = cellAt(line, idx, dir);
      if (t.row !== p.row || t.col !== p.col) changed = true;
      t.row = p.row;
      t.col = p.col;
      result.push(t);
    });
  }

  return { tiles: result, gained, changed };
}

const tileClasses: Record<number, string> = {
  2: "bg-game-surface-2 text-game-text",
  4: "bg-game-accent/15 text-game-text",
  8: "bg-game-accent/30 text-game-accent",
  16: "bg-game-accent/45 text-white",
  32: "bg-game-accent/60 text-white",
  64: "bg-game-accent/80 text-white",
  128: "bg-game-accent text-white",
  256: "bg-game-secondary/60 text-white",
  512: "bg-game-secondary/80 text-white",
  1024: "bg-game-secondary text-white",
};

function tileClass(value: number) {
  return (
    tileClasses[value] ??
    "bg-game-secondary text-white ring-4 ring-game-accent/50"
  );
}

function tileFont(value: number) {
  if (value < 100) return "text-3xl";
  if (value < 1000) return "text-2xl";
  return "text-xl";
}

export default function Game2048() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (raw) setBest(Number(raw) || 0);
    } catch {
      /* storage unavailable, best score stays in memory */
    }
  }, []);

  const saveBest = useCallback((value: number) => {
    setBest(value);
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      /* storage unavailable, best score stays in memory */
    }
  }, []);

  const spawn = useCallback((current: Tile[], count: number) => {
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
        isNew: true,
        merged: false,
      });
    }
    return out;
  }, []);

  const startGame = useCallback(() => {
    setTiles(spawn([], 2));
    setScore(0);
    setKeepPlaying(false);
    setPhase("playing");
  }, [spawn]);

  const move = useCallback(
    (dir: Dir) => {
      if (phase !== "playing") return;
      const { tiles: moved, gained, changed } = slide(tiles, dir);
      if (!changed) return;

      const withNew = spawn(moved, 1);
      const newScore = score + gained;
      setTiles(withNew);
      setScore(newScore);
      if (newScore > best) saveBest(newScore);

      if (!keepPlaying && withNew.some((t) => t.value >= TARGET)) {
        setPhase("won");
        return;
      }
      if (!hasMoves(withNew)) setPhase("lost");
    },
    [phase, tiles, score, best, keepPlaying, spawn, saveBest]
  );

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
      const dir = keyMap[e.key] ?? keyMap[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  useSwipe((dir) => move(dir));

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Swipe the board with the arrow keys, the WASD keys, the on-screen
            pad, or a finger swipe.
          </p>
          <p className="text-game-text-dim">
            Every tile slides as far as it can. Two tiles with the same number
            join into one that is twice as large.
          </p>
          <p className="text-game-text-dim">
            Reach the 2048 tile before the board runs out of room.
          </p>
        </div>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  const highest = tiles.reduce((m, t) => Math.max(m, t.value), 0);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Best" value={best || "—"} />
        <ScoreDisplay label="Top tile" value={highest || "—"} />
      </div>

      <div className="relative w-full aspect-square rounded-2xl border-2 border-game-border bg-game-surface p-1 select-none touch-none">
        {Array.from({ length: SIZE * SIZE }).map((_, i) => (
          <div
            key={`cell-${i}`}
            className="absolute p-1"
            style={{
              left: `${(i % SIZE) * 25}%`,
              top: `${Math.floor(i / SIZE) * 25}%`,
              width: "25%",
              height: "25%",
            }}
          >
            <div className="w-full h-full rounded-xl bg-game-bg/60 border border-game-border-dim" />
          </div>
        ))}

        {tiles.map((t) => (
          <div
            key={t.id}
            className="absolute p-1 transition-all duration-150 ease-out"
            style={{
              left: `${t.col * 25}%`,
              top: `${t.row * 25}%`,
              width: "25%",
              height: "25%",
            }}
          >
            <div
              className={`w-full h-full rounded-xl flex items-center justify-center font-black tabular-nums shadow-md-1 ${tileClass(
                t.value
              )} ${tileFont(t.value)} ${t.isNew ? "animate-fade-in" : ""} ${
                t.merged ? "animate-slide-up" : ""
              }`}
            >
              {t.value}
            </div>
          </div>
        ))}

        {(phase === "won" || phase === "lost") && (
          <div className="absolute inset-0 rounded-2xl bg-game-bg/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 text-center animate-fade-in">
            <GameMessage type={phase === "won" ? "success" : "error"}>
              {phase === "won"
                ? "You built the 2048 tile."
                : "No moves left. The board is full."}
            </GameMessage>
            <ScoreDisplay label="Score" value={score} size="sm" highlight />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {phase === "won" && (
                <GameButton
                  variant="secondary"
                  onClick={() => {
                    setKeepPlaying(true);
                    setPhase("playing");
                  }}
                >
                  Keep playing
                </GameButton>
              )}
              <GameButton onClick={startGame}>Play again</GameButton>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 w-44 mx-auto">
        <div />
        <GameButton
          variant="secondary"
          aria-label="Move up"
          onClick={() => move("up")}
        >
          ↑
        </GameButton>
        <div />
        <GameButton
          variant="secondary"
          aria-label="Move left"
          onClick={() => move("left")}
        >
          ←
        </GameButton>
        <GameButton
          variant="secondary"
          aria-label="Move down"
          onClick={() => move("down")}
        >
          ↓
        </GameButton>
        <GameButton
          variant="secondary"
          aria-label="Move right"
          onClick={() => move("right")}
        >
          →
        </GameButton>
      </div>

      <div className="flex items-center justify-center gap-3">
        <GameButton variant="ghost" size="sm" onClick={startGame}>
          New game
        </GameButton>
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          Quit
        </GameButton>
      </div>
    </div>
  );
}
