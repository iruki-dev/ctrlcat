import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won";
type Level = "easy" | "medium" | "hard" | "expert";

const LEVELS: { id: Level; label: string; blanks: number }[] = [
  { id: "easy", label: "Easy", blanks: 38 },
  { id: "medium", label: "Medium", blanks: 46 },
  { id: "hard", label: "Hard", blanks: 52 },
  { id: "expert", label: "Expert", blanks: 55 },
];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function canPlace(grid: number[], index: number, value: number): boolean {
  const row = Math.floor(index / 9);
  const col = index % 9;
  for (let i = 0; i < 9; i++) {
    if (grid[row * 9 + i] === value && row * 9 + i !== index) return false;
    if (grid[i * 9 + col] === value && i * 9 + col !== index) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const at = r * 9 + c;
      if (grid[at] === value && at !== index) return false;
    }
  }
  return true;
}

/* Fill an empty grid with a random complete solution. */
function buildSolution(): number[] {
  const grid = new Array(81).fill(0);
  const fill = (index: number): boolean => {
    if (index === 81) return true;
    for (const value of shuffled(DIGITS)) {
      if (canPlace(grid, index, value)) {
        grid[index] = value;
        if (fill(index + 1)) return true;
        grid[index] = 0;
      }
    }
    return false;
  };
  fill(0);
  return grid;
}

/* Count solutions, stopping as soon as a second one is found. */
function countSolutions(grid: number[], limit = 2): number {
  let best = -1;
  let fewest = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    let options = 0;
    for (const value of DIGITS) if (canPlace(grid, i, value)) options++;
    if (options === 0) return 0;
    if (options < fewest) {
      fewest = options;
      best = i;
      if (options === 1) break;
    }
  }
  if (best === -1) return 1;

  let found = 0;
  for (const value of DIGITS) {
    if (!canPlace(grid, best, value)) continue;
    grid[best] = value;
    found += countSolutions(grid, limit - found);
    grid[best] = 0;
    if (found >= limit) break;
  }
  return found;
}

/* Remove digits from a solved grid while keeping exactly one solution. */
function carvePuzzle(solution: number[], blanks: number): number[] {
  const puzzle = solution.slice();
  let removed = 0;
  for (const index of shuffled([...Array(81).keys()])) {
    if (removed >= blanks) break;
    const kept = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle.slice()) === 1) {
      removed++;
    } else {
      puzzle[index] = kept;
    }
  }
  return puzzle;
}

function conflictsAt(grid: number[], index: number): boolean {
  const value = grid[index];
  return value !== 0 && !canPlace(grid, index, value);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Sudoku() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState<Level>("easy");
  const [given, setGiven] = useState<number[]>(() => new Array(81).fill(0));
  const [grid, setGrid] = useState<number[]>(() => new Array(81).fill(0));
  const [solution, setSolution] = useState<number[]>(() => new Array(81).fill(0));
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 81 }, () => []));
  const [selected, setSelected] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestTimes, setBestTimes] = useState<Partial<Record<Level, number>>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback((chosen: Level) => {
    const blanks = LEVELS.find((l) => l.id === chosen)?.blanks ?? 38;
    const answer = buildSolution();
    const puzzle = carvePuzzle(answer, blanks);
    setLevel(chosen);
    setSolution(answer);
    setGiven(puzzle);
    setGrid(puzzle.slice());
    setNotes(Array.from({ length: 81 }, () => []));
    setSelected(puzzle.findIndex((v) => v === 0));
    setMistakes(0);
    setElapsed(0);
    setNoteMode(false);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "playing") boardRef.current?.focus();
  }, [phase]);

  const place = useCallback(
    (index: number, value: number) => {
      if (phase !== "playing" || given[index] !== 0) return;

      if (value !== 0 && noteMode) {
        setNotes((prev) => {
          const next = prev.map((n) => n.slice());
          const at = next[index].indexOf(value);
          if (at === -1) next[index] = [...next[index], value].sort();
          else next[index].splice(at, 1);
          return next;
        });
        return;
      }

      if (value !== 0 && solution[index] !== value) setMistakes((m) => m + 1);

      setNotes((prev) => {
        if (value === 0 && prev[index].length === 0) return prev;
        const next = prev.map((n) => n.slice());
        next[index] = [];
        return next;
      });

      const next = grid.slice();
      next[index] = value;
      setGrid(next);

      if (value !== 0 && next.every((cell, i) => cell === solution[i])) {
        setPhase("won");
        setBestTimes((best) => {
          const current = best[level];
          if (current === undefined || elapsed < current) return { ...best, [level]: elapsed };
          return best;
        });
      }
    },
    [phase, given, noteMode, solution, level, elapsed, grid],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      const row = Math.floor(selected / 9);
      const col = selected % 9;

      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        const dRow = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
        const dCol = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
        const nextRow = Math.min(8, Math.max(0, row + dRow));
        const nextCol = Math.min(8, Math.max(0, col + dCol));
        setSelected(nextRow * 9 + nextCol);
        return;
      }
      if (key >= "1" && key <= "9") {
        event.preventDefault();
        place(selected, Number(key));
        return;
      }
      if (key === "0" || key === "Backspace" || key === "Delete") {
        event.preventDefault();
        place(selected, 0);
        return;
      }
      if (key === "n" || key === "N") {
        event.preventDefault();
        setNoteMode((m) => !m);
      }
    },
    [selected, place],
  );

  const focusBoard = useCallback(() => boardRef.current?.focus(), []);

  const filled = grid.filter((v) => v !== 0).length;

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          Fill the grid so every row, column, and 3x3 box holds 1 through 9 exactly once. Every
          puzzle has one solution, so you never need to guess.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {LEVELS.map((item) => (
            <GameButton
              key={item.id}
              onClick={() => startGame(item.id)}
              variant={item.id === "easy" ? "primary" : "secondary"}
              size="lg"
            >
              {item.label}
            </GameButton>
          ))}
        </div>
        <p className="text-xs text-game-muted">
          Arrow keys move, 1 to 9 place a digit, 0 clears, N toggles notes.
        </p>
      </div>
    );
  }

  if (phase === "won") {
    const best = bestTimes[level];
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Time" value={formatTime(elapsed)} size="lg" highlight />
          <ScoreDisplay label="Mistakes" value={mistakes} size="lg" />
        </div>
        <GameMessage type="success">
          Solved on {LEVELS.find((l) => l.id === level)?.label.toLowerCase()}
          {best !== undefined && best === elapsed ? " — a new best time." : "."}
        </GameMessage>
        <div className="flex flex-wrap gap-3 justify-center">
          <GameButton onClick={() => startGame(level)} size="xl">
            Play again
          </GameButton>
          <GameButton variant="ghost" size="lg" onClick={() => setPhase("idle")}>
            Change difficulty
          </GameButton>
        </div>
      </div>
    );
  }

  const selectedValue = grid[selected];

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Time" value={formatTime(elapsed)} size="sm" highlight />
        <ScoreDisplay label="Filled" value={`${filled}/81`} size="sm" />
        <ScoreDisplay label="Mistakes" value={mistakes} size="sm" />
      </div>

      <div
        ref={boardRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Sudoku board"
        className="grid grid-cols-9 gap-px bg-game-border p-1 rounded-2xl border-2 border-game-border outline-none focus:ring-2 focus:ring-game-accent/50 select-none"
      >
        {grid.map((value, index) => {
          const row = Math.floor(index / 9);
          const col = index % 9;
          const isGiven = given[index] !== 0;
          const isSelected = index === selected;
          const bad = conflictsAt(grid, index) && !isGiven;
          const sameRegion =
            !isSelected &&
            (row === Math.floor(selected / 9) ||
              col === selected % 9 ||
              (Math.floor(row / 3) === Math.floor(Math.floor(selected / 9) / 3) &&
                Math.floor(col / 3) === Math.floor((selected % 9) / 3)));
          const sameValue = !isSelected && value !== 0 && value === selectedValue;

          let tone: string;
          if (bad) {
            tone = "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 font-bold";
          } else if (sameValue) {
            tone = "bg-game-accent/20 text-game-accent font-bold";
          } else if (isGiven) {
            tone = `${sameRegion ? "bg-game-accent/[.07]" : "bg-game-surface"} text-game-text font-black`;
          } else {
            tone = `${sameRegion ? "bg-game-accent/[.07]" : "bg-game-bg"} ${
              value !== 0 ? "text-game-accent font-bold" : "text-game-text"
            }`;
          }
          if (isSelected) tone += " ring-2 ring-game-accent z-10";

          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Row ${row + 1} column ${col + 1}${value ? `, ${value}` : ", empty"}`}
              className={`relative aspect-square flex items-center justify-center text-base sm:text-lg tabular-nums transition-colors duration-150 ${tone} ${
                col % 3 === 2 && col !== 8 ? "mr-0.5" : ""
              } ${row % 3 === 2 && row !== 8 ? "mb-0.5" : ""}`}
            >
              {value !== 0 ? (
                value
              ) : notes[index].length > 0 ? (
                <span className="grid grid-cols-3 gap-px text-[0.5rem] leading-none text-game-muted p-0.5">
                  {DIGITS.map((d) => (
                    <span key={d} className="w-2 h-2 flex items-center justify-center">
                      {notes[index].includes(d) ? d : ""}
                    </span>
                  ))}
                </span>
              ) : (
                ""
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {DIGITS.map((d) => {
          const remaining = 9 - grid.filter((v) => v === d).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                place(selected, d);
                focusBoard();
              }}
              disabled={remaining <= 0 && !noteMode}
              className="rounded-xl border-2 border-game-border bg-game-surface py-3 text-lg font-bold text-game-text tabular-nums transition-colors duration-150 hover:border-game-accent hover:text-game-accent disabled:opacity-40 disabled:hover:border-game-border disabled:hover:text-game-text"
            >
              {d}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            place(selected, 0);
            focusBoard();
          }}
          className="rounded-xl border-2 border-game-border bg-game-surface py-3 text-sm font-bold text-game-text-dim transition-colors duration-150 hover:border-game-accent hover:text-game-accent"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GameButton
          variant={noteMode ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setNoteMode((m) => !m);
            focusBoard();
          }}
        >
          Notes {noteMode ? "on" : "off"}
        </GameButton>
        <div className="flex gap-2">
          <GameButton variant="ghost" size="sm" onClick={() => startGame(level)}>
            New puzzle
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Quit
          </GameButton>
        </div>
      </div>

      {mistakes > 0 && (
        <GameMessage type="warning">
          {mistakes === 1 ? "One digit does not match the solution." : `${mistakes} digits placed so far do not match the solution.`}
        </GameMessage>
      )}
    </div>
  );
}
