import { useState, useCallback } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameMessage } from "../../components/games/ui/GameMessage";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";

type Cell = "X" | "O" | null;
type Board = Cell[];

const LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinLine(board: Board): [number, number, number] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function isDraw(board: Board): boolean {
  return board.every((c) => c !== null) && !getWinLine(board);
}

function minimax(board: Board, isMax: boolean, depth: number): number {
  const win = getWinLine(board);
  if (win) return board[win[0]] === "O" ? 10 - depth : depth - 10;
  if (isDraw(board)) return 0;

  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = isMax ? "O" : "X";
      scores.push(minimax(board, !isMax, depth + 1));
      board[i] = null;
    }
  }
  return isMax ? Math.max(...scores) : Math.min(...scores);
}

function bestAiMove(board: Board): number {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = "O";
      const score = minimax(board, false, 0);
      board[i] = null;
      if (score > best) { best = score; move = i; }
    }
  }
  return move;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [xWins, setXWins] = useState(0);
  const [oWins, setOWins] = useState(0);
  const [draws, setDraws] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"X" | "O" | "draw" | null>(null);

  const handleClick = useCallback(
    (idx: number) => {
      if (board[idx] || gameOver) return;

      const next = [...board];
      next[idx] = "X";

      const winLine = getWinLine(next);
      if (winLine) {
        setBoard(next);
        setResult("X");
        setXWins((n) => n + 1);
        setGameOver(true);
        return;
      }
      if (isDraw(next)) {
        setBoard(next);
        setResult("draw");
        setDraws((n) => n + 1);
        setGameOver(true);
        return;
      }

      const aiIdx = bestAiMove(next);
      next[aiIdx] = "O";

      const aiWin = getWinLine(next);
      setBoard(next);
      if (aiWin) {
        setResult("O");
        setOWins((n) => n + 1);
        setGameOver(true);
      } else if (isDraw(next)) {
        setResult("draw");
        setDraws((n) => n + 1);
        setGameOver(true);
      }
    },
    [board, gameOver]
  );

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setResult(null);
  }, []);

  const winLine = getWinLine(board);

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-6 animate-slide-up">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="You (X)" value={xWins} size="sm" />
        <ScoreDisplay label="Draws" value={draws} size="sm" />
        <ScoreDisplay label="AI (O)" value={oWins} size="sm" />
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2.5">
        {board.map((cell, i) => {
          const isWin = winLine?.includes(i) ?? false;
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!!cell || gameOver}
              className={`h-24 rounded-2xl border-2 text-4xl font-black transition-all duration-150
                ${
                  isWin
                    ? cell === "X"
                      ? "border-game-accent bg-game-accent/10 scale-105"
                      : "border-game-secondary bg-game-secondary/10 scale-105"
                    : cell
                      ? "border-game-border bg-game-surface"
                      : "border-game-border bg-game-surface hover:border-game-accent/50 hover:bg-game-surface-2 active:scale-95"
                }`}
            >
              <span className={cell === "X" ? "text-game-accent" : "text-game-secondary"}>
                {cell}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status */}
      {gameOver && result ? (
        <div className="flex flex-col gap-3">
          <GameMessage
            type={result === "X" ? "success" : result === "draw" ? "info" : "error"}
          >
            {result === "X"
              ? "You win! The AI made an error — or you played perfectly."
              : result === "draw"
                ? "Draw! Well played — that is the best possible result against a perfect AI."
                : "AI wins. Try a different opening — corners or center are strongest."}
          </GameMessage>
          <GameButton onClick={reset} size="lg" className="w-full">
            Play again
          </GameButton>
        </div>
      ) : (
        <div className="text-center text-sm text-game-muted py-1">
          Your turn — tap any cell (you are X)
        </div>
      )}
    </div>
  );
}
