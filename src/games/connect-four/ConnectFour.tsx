import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

const ROWS = 6;
const COLS = 7;
const SEARCH_DEPTH = 5;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

type Cell = 0 | 1 | 2;
type Board = Cell[][];
type Phase = "idle" | "playing" | "over";
type Turn = "you" | "ai";
type Result = "win" | "lose" | "draw";

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function landingRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function openColumns(board: Board): number[] {
  return ORDER.filter((c) => board[0][c] === 0);
}

function isFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function winningLine(board: Board, player: Cell): [number, number][] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of DIRS) {
        const line: [number, number][] = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== player) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

function hasWon(board: Board, player: Cell): boolean {
  return winningLine(board, player) !== null;
}

function scoreWindow(window: Cell[], player: Cell): number {
  const rival: Cell = player === 2 ? 1 : 2;
  let mine = 0;
  let theirs = 0;
  let empty = 0;
  for (const cell of window) {
    if (cell === player) mine++;
    else if (cell === rival) theirs++;
    else empty++;
  }
  if (mine === 4) return 10000;
  if (theirs === 4) return -10000;
  if (mine === 3 && empty === 1) return 60;
  if (mine === 2 && empty === 2) return 8;
  if (theirs === 3 && empty === 1) return -90;
  if (theirs === 2 && empty === 2) return -6;
  return 0;
}

function evaluate(board: Board, player: Cell): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r][3] === player) score += 6;
    else if (board[r][3] !== 0) score -= 6;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        const window: Cell[] = [
          board[r][c],
          board[r + dr][c + dc],
          board[r + dr * 2][c + dc * 2],
          board[r + dr * 3][c + dc * 3],
        ];
        score += scoreWindow(window, player);
      }
    }
  }
  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, aiTurn: boolean): number {
  if (hasWon(board, 2)) return 500000 + depth;
  if (hasWon(board, 1)) return -500000 - depth;
  if (isFull(board)) return 0;
  if (depth === 0) return evaluate(board, 2);

  const columns = openColumns(board);
  if (aiTurn) {
    let best = -Infinity;
    for (const col of columns) {
      const row = landingRow(board, col);
      board[row][col] = 2;
      const value = minimax(board, depth - 1, alpha, beta, false);
      board[row][col] = 0;
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const col of columns) {
    const row = landingRow(board, col);
    board[row][col] = 1;
    const value = minimax(board, depth - 1, alpha, beta, true);
    board[row][col] = 0;
    if (value < best) best = value;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseColumn(board: Board): number {
  const working = cloneBoard(board);
  const columns = openColumns(working);
  if (columns.length === 0) return -1;

  let bestCol = columns[0];
  let bestValue = -Infinity;
  for (const col of columns) {
    const row = landingRow(working, col);
    working[row][col] = 2;
    const value = minimax(working, SEARCH_DEPTH - 1, -Infinity, Infinity, false);
    working[row][col] = 0;
    if (value > bestValue) {
      bestValue = value;
      bestCol = col;
    }
  }
  return bestCol;
}

export default function ConnectFour() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turn, setTurn] = useState<Turn>("you");
  const [result, setResult] = useState<Result | null>(null);
  const [line, setLine] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState(3);
  const [moves, setMoves] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback(() => {
    setBoard(createBoard());
    setPhase("playing");
    setTurn("you");
    setResult(null);
    setLine([]);
    setCursor(3);
    setMoves(0);
  }, []);

  const finish = useCallback((outcome: Result, won: [number, number][]) => {
    setLine(won);
    setResult(outcome);
    setPhase("over");
    if (outcome === "win") setWins((w) => w + 1);
    if (outcome === "lose") setLosses((l) => l + 1);
  }, []);

  const drop = useCallback(
    (col: number) => {
      if (phase !== "playing" || turn !== "you") return;
      const row = landingRow(board, col);
      if (row < 0) return;
      const next = cloneBoard(board);
      next[row][col] = 1;
      setBoard(next);
      setMoves((m) => m + 1);
      setCursor(col);
      const won = winningLine(next, 1);
      if (won) finish("win", won);
      else if (isFull(next)) finish("draw", []);
      else setTurn("ai");
    },
    [board, finish, phase, turn],
  );

  useEffect(() => {
    if (phase !== "playing" || turn !== "ai") return;
    const timer = window.setTimeout(() => {
      const col = chooseColumn(board);
      if (col < 0) {
        finish("draw", []);
        return;
      }
      const row = landingRow(board, col);
      const next = cloneBoard(board);
      next[row][col] = 2;
      setBoard(next);
      const won = winningLine(next, 2);
      if (won) finish("lose", won);
      else if (isFull(next)) finish("draw", []);
      else setTurn("you");
    }, 420);
    return () => window.clearTimeout(timer);
  }, [board, finish, phase, turn]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCursor((c) => (c + COLS - 1) % COLS);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCursor((c) => (c + 1) % COLS);
      } else if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        drop(cursor);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, drop, phase]);

  useEffect(() => {
    if (phase === "playing") boardRef.current?.focus();
  }, [phase]);

  const inLine = (r: number, c: number) => line.some(([lr, lc]) => lr === r && lc === c);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          Drop a disc into a column and line up four of your own discs in a row. Rows, columns and diagonals all count.
          The computer plays the other colour and looks several moves ahead.
        </p>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  const statusText =
    result === "win"
      ? "Four in a row. You win!"
      : result === "lose"
        ? "The computer connected four."
        : result === "draw"
          ? "The grid is full. It is a draw."
          : turn === "you"
            ? "Your turn. Pick a column."
            : "The computer is thinking.";

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Your wins" value={wins} size="sm" highlight />
        <ScoreDisplay label="Computer" value={losses} size="sm" />
        <ScoreDisplay label="Your moves" value={moves} size="sm" />
      </div>

      <div
        ref={boardRef}
        tabIndex={0}
        aria-label="Connect four grid"
        className="rounded-3xl border-2 border-game-border bg-game-surface p-3 focus:outline-none focus:ring-2 focus:ring-game-accent"
      >
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: COLS }, (_, c) => {
            const playable = phase === "playing" && turn === "you" && landingRow(board, c) >= 0;
            return (
              <button
                key={c}
                type="button"
                onClick={() => drop(c)}
                onMouseEnter={() => phase === "playing" && setCursor(c)}
                disabled={!playable}
                aria-label={`Drop in column ${c + 1}`}
                className={`flex flex-col gap-1.5 rounded-2xl p-1 transition-colors duration-200 ${
                  playable ? "cursor-pointer hover:bg-game-accent/[.10]" : "cursor-default"
                } ${cursor === c && playable ? "bg-game-accent/[.08]" : ""}`}
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-200 ${
                    cursor === c && playable ? "bg-game-accent" : "bg-transparent"
                  }`}
                />
                {Array.from({ length: ROWS }, (_, r) => {
                  const cell = board[r][c];
                  return (
                    <span
                      key={`${r}-${c}-${cell}`}
                      className={`block aspect-square w-full rounded-full border transition-colors duration-200 ${
                        cell === 0
                          ? "border-game-border bg-game-bg"
                          : cell === 1
                            ? "border-game-accent bg-game-accent animate-slide-up"
                            : "border-game-secondary bg-game-secondary animate-slide-up"
                      } ${inLine(r, c) ? "ring-4 ring-game-text/60" : ""}`}
                    />
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      <GameMessage type={result === "win" ? "success" : result === "lose" ? "error" : result === "draw" ? "warning" : "info"}>
        {statusText}
      </GameMessage>

      {phase === "over" ? (
        <div className="flex flex-col items-center gap-3 animate-slide-up">
          <GameButton onClick={startGame} size="xl">
            Play again
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Back to start
          </GameButton>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-game-text-dim">
            Arrow keys move, Enter drops. You are the purple disc.
          </span>
          <GameButton variant="ghost" size="sm" onClick={startGame}>
            Restart
          </GameButton>
        </div>
      )}
    </div>
  );
}
