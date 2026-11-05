import { useCallback, useEffect, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "levelCleared" | "won" | "lost";

interface Level {
  size: number;
  seeds: number;
  minPar: number;
}

const LEVELS: Level[] = [
  { size: 3, seeds: 3, minPar: 3 },
  { size: 3, seeds: 5, minPar: 5 },
  { size: 4, seeds: 5, minPar: 4 },
  { size: 4, seeds: 7, minPar: 6 },
  { size: 5, seeds: 7, minPar: 6 },
  { size: 5, seeds: 9, minPar: 8 },
];

const BUILD_ATTEMPTS = 60;

function solveLength(board: boolean[], size: number): number | null {
  let best: number | null = null;
  const combos = 1 << size;
  for (let mask = 0; mask < combos; mask += 1) {
    const work = board.slice();
    let presses = 0;
    for (let col = 0; col < size; col += 1) {
      if (mask & (1 << col)) {
        toggleAt(work, col, size);
        presses += 1;
      }
    }
    for (let row = 1; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (work[(row - 1) * size + col]) {
          toggleAt(work, row * size + col, size);
          presses += 1;
        }
      }
    }
    if (work.every((lit) => !lit) && (best === null || presses < best)) {
      best = presses;
    }
  }
  return best;
}

function toggleAt(board: boolean[], index: number, size: number): void {
  const row = Math.floor(index / size);
  const col = index % size;
  const targets = [
    [row, col],
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  for (const [r, c] of targets) {
    if (r < 0 || r >= size || c < 0 || c >= size) continue;
    const i = r * size + c;
    board[i] = !board[i];
  }
}

function pressed(board: boolean[], index: number, size: number): boolean[] {
  const next = board.slice();
  toggleAt(next, index, size);
  return next;
}

function buildBoard(level: Level): boolean[] {
  const total = level.size * level.size;
  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const board = new Array<boolean>(total).fill(false);
  for (const index of order.slice(0, Math.min(level.seeds, total))) {
    toggleAt(board, index, level.size);
  }
  if (board.every((lit) => !lit)) {
    toggleAt(board, order[0], level.size);
  }
  return board;
}

function buildPuzzle(level: Level): { board: boolean[]; par: number } {
  let fallback = { board: buildBoard(level), par: 0 };
  fallback.par = solveLength(fallback.board, level.size) ?? level.seeds;

  for (let attempt = 0; attempt < BUILD_ATTEMPTS; attempt += 1) {
    const board = buildBoard(level);
    const par = solveLength(board, level.size) ?? level.seeds;
    if (par >= level.minPar) return { board, par };
    if (par > fallback.par) fallback = { board, par };
  }
  return fallback;
}

function litCount(board: boolean[]): number {
  return board.reduce((sum, lit) => sum + (lit ? 1 : 0), 0);
}

export default function LightsOut() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [levelIndex, setLevelIndex] = useState(0);
  const [board, setBoard] = useState<boolean[]>([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [par, setPar] = useState(0);

  const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  const size = level.size;
  const allowance = par + size + 2;
  const movesLeft = Math.max(0, allowance - moves);

  const loadLevel = useCallback((index: number) => {
    const next = LEVELS[index];
    const puzzle = buildPuzzle(next);
    setLevelIndex(index);
    setBoard(puzzle.board);
    setPar(puzzle.par);
    setMoves(0);
    setCursor(Math.floor((next.size * next.size) / 2));
    setPhase("playing");
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setLastGain(0);
    loadLevel(0);
  }, [loadLevel]);

  const restartLevel = useCallback(() => {
    loadLevel(levelIndex);
  }, [loadLevel, levelIndex]);

  const press = useCallback(
    (index: number) => {
      if (phase !== "playing") return;
      setCursor(index);
      const nextBoard = pressed(board, index, size);
      const nextMoves = moves + 1;
      setBoard(nextBoard);
      setMoves(nextMoves);

      if (nextBoard.every((lit) => !lit)) {
        const gain = 100 + 20 * Math.max(0, allowance - nextMoves);
        const nextScore = score + gain;
        setScore(nextScore);
        setLastGain(gain);
        if (levelIndex === LEVELS.length - 1) {
          setPhase("won");
          setBestScore((best) => (best === null || nextScore > best ? nextScore : best));
        } else {
          setPhase("levelCleared");
        }
        return;
      }

      if (nextMoves >= allowance) {
        setPhase("lost");
        setBestScore((best) => (best === null || score > best ? score : best));
      }
    },
    [allowance, board, levelIndex, moves, phase, score, size],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const total = size * size;
      const row = Math.floor(cursor / size);
      const col = cursor % size;
      let handled = true;

      switch (event.key) {
        case "ArrowUp":
          setCursor(((row - 1 + size) % size) * size + col);
          break;
        case "ArrowDown":
          setCursor(((row + 1) % size) * size + col);
          break;
        case "ArrowLeft":
          setCursor(row * size + ((col - 1 + size) % size));
          break;
        case "ArrowRight":
          setCursor(row * size + ((col + 1) % size));
          break;
        case "Enter":
        case " ":
          press(Math.min(cursor, total - 1));
          break;
        case "r":
        case "R":
          restartLevel();
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cursor, phase, press, restartLevel, size]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Every tap flips a light and its four neighbours. Turn the whole grid dark to clear the level.
          </p>
          <p className="text-game-text-dim text-sm">
            Six levels, from three by three up to five by five. Each level gives you a limited number of taps.
          </p>
        </div>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Score" value={score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? "All six grids are dark. You cleared the set."
            : `Out of taps on level ${levelIndex + 1}. ${litCount(board)} lights still on.`}
        </GameMessage>
        {bestScore !== null && (
          <p className="text-game-text-dim text-sm">Best score so far: {bestScore}</p>
        )}
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  const remaining = litCount(board);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Level" value={`${levelIndex + 1} / ${LEVELS.length}`} />
        <ScoreDisplay label="Taps left" value={movesLeft} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-game-text-dim">
          Lights on: <span className="text-game-text font-semibold">{remaining}</span>
        </span>
        <span className="text-game-text-dim">
          Par <span className="text-game-accent font-semibold">{par}</span> · Grid {size} x {size}
        </span>
      </div>

      <div
        className="grid gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-game-surface border-2 border-game-border"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label={`Lights out grid, ${size} by ${size}`}
      >
        {board.map((lit, index) => {
          const isCursor = index === cursor;
          return (
            <button
              key={index}
              type="button"
              onClick={() => press(index)}
              onMouseEnter={() => setCursor(index)}
              disabled={phase !== "playing"}
              aria-label={`Row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}, ${lit ? "on" : "off"}`}
              aria-pressed={lit}
              className={`aspect-square rounded-xl border-2 transition-all duration-200 focus:outline-none active:scale-95 disabled:cursor-not-allowed ${
                lit
                  ? "bg-game-accent border-game-accent shadow-lg"
                  : "bg-game-bg border-game-border-dim hover:border-game-accent"
              } ${isCursor ? "ring-2 ring-game-secondary ring-offset-2 ring-offset-game-surface" : ""}`}
            >
              <span
                className={`block mx-auto rounded-full transition-all duration-200 ${
                  lit ? "w-1/3 h-1/3 bg-game-accent-light" : "w-1/5 h-1/5 bg-game-border-dim"
                }`}
              />
            </button>
          );
        })}
      </div>

      {phase === "levelCleared" ? (
        <div className="flex flex-col gap-3 animate-slide-up">
          <GameMessage type="success">
            Level {levelIndex + 1} cleared in {moves} {moves === 1 ? "tap" : "taps"}. Plus {lastGain} points.
          </GameMessage>
          <GameButton onClick={() => loadLevel(levelIndex + 1)} size="lg">
            Next level
          </GameButton>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <GameButton variant="secondary" size="sm" onClick={restartLevel}>
            Restart level
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Quit
          </GameButton>
        </div>
      )}

      <p className="text-game-text-dim text-xs text-center">
        Click a cell, or use the arrow keys and Enter. Press R to reshuffle the level.
      </p>
    </div>
  );
}
