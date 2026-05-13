import { useState, useCallback, useEffect } from "react";
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

// SVG board constants
const BS = 300; // board size
const CELL = BS / 3; // 100
const INSET = 18; // grid line inset from edge
const MARK_R = 30; // O radius
const X_OFF = 27; // X arm half-length

// Colors use CSS variables so dark mode updates automatically
const BG        = "rgb(var(--game-surface-2))";
const GRID      = "rgb(var(--game-border))";
const X_CLR     = "rgb(var(--game-accent-dim))";
const O_CLR     = "rgb(var(--game-accent))";
const WIN_CLR   = "rgb(var(--game-accent) / 0.5)";
const WIN_CELL_FILL = "rgb(var(--game-accent) / 0.07)";

function cellCenter(i: number) {
  return {
    x: (i % 3) * CELL + CELL / 2,
    y: Math.floor(i / 3) * CELL + CELL / 2,
  };
}

function getWinLineCoords(line: [number, number, number]) {
  const a = cellCenter(line[0]);
  const c = cellCenter(line[2]);
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ext = 22;
  return {
    x1: a.x - (dx / len) * ext,
    y1: a.y - (dy / len) * ext,
    x2: c.x + (dx / len) * ext,
    y2: c.y + (dy / len) * ext,
  };
}

// Animated X mark
function XMark({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    let id = requestAnimationFrame(() => {
      setStep(1);
      setTimeout(() => setStep(2), 90);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <g>
      <line
        x1={cx - X_OFF} y1={cy - X_OFF}
        x2={cx + X_OFF} y2={cy + X_OFF}
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={step >= 1 ? 0 : 1}
        style={{ transition: "stroke-dashoffset 0.22s ease-out" }}
      />
      <line
        x1={cx + X_OFF} y1={cy - X_OFF}
        x2={cx - X_OFF} y2={cy + X_OFF}
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={step >= 2 ? 0 : 1}
        style={{ transition: "stroke-dashoffset 0.22s ease-out" }}
      />
    </g>
  );
}

// Animated O mark
function OMark({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <circle
      cx={cx} cy={cy} r={MARK_R}
      fill="none"
      stroke={color}
      strokeWidth="5.5"
      strokeLinecap="round"
      pathLength="1"
      strokeDasharray="1"
      strokeDashoffset={drawn ? 0 : 1}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
    />
  );
}

// Animated win line
function WinLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={WIN_CLR}
      strokeWidth="7"
      strokeLinecap="round"
      pathLength="1"
      strokeDasharray="1"
      strokeDashoffset={drawn ? 0 : 1}
      style={{ transition: "stroke-dashoffset 0.38s ease-out" }}
    />
  );
}

function Board({
  board,
  winLine,
  onCellClick,
  gameOver,
}: {
  board: Board;
  winLine: [number, number, number] | null;
  onCellClick: (i: number) => void;
  gameOver: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const winCoords = winLine ? getWinLineCoords(winLine) : null;

  return (
    <svg
      width={BS}
      height={BS}
      viewBox={`0 0 ${BS} ${BS}`}
      className="w-full max-w-[320px] mx-auto block"
      style={{ touchAction: "manipulation" }}
    >
      {/* Background */}
      <rect width={BS} height={BS} rx="20" fill={BG} />

      {/* Win cell highlights */}
      {winLine?.map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect
            key={`wh-${i}`}
            x={col * CELL + 4}
            y={row * CELL + 4}
            width={CELL - 8}
            height={CELL - 8}
            rx="12"
            fill={WIN_CELL_FILL}
          />
        );
      })}

      {/* Grid lines */}
      <line x1={CELL}     y1={INSET}      x2={CELL}     y2={BS - INSET} stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={CELL * 2} y1={INSET}      x2={CELL * 2} y2={BS - INSET} stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={INSET}    y1={CELL}       x2={BS - INSET} y2={CELL}     stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={INSET}    y1={CELL * 2}   x2={BS - INSET} y2={CELL * 2} stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />

      {/* Hover ghost mark */}
      {hovered !== null && !board[hovered] && !gameOver && (
        <text
          x={cellCenter(hovered).x}
          y={cellCenter(hovered).y + 14}
          textAnchor="middle"
          fontSize="40"
          fontWeight="900"
          style={{ pointerEvents: "none", fontFamily: "system-ui, sans-serif",
                   fill: "rgb(var(--game-accent) / 0.18)" }}
        >
          X
        </text>
      )}

      {/* Marks */}
      {board.map((cell, i) => {
        if (!cell) return null;
        const { x, y } = cellCenter(i);
        const isWin = winLine?.includes(i) ?? false;
        if (cell === "X") {
          return <XMark key={i} cx={x} cy={y} color={isWin ? "#a855f7" : X_CLR} />;
        }
        return <OMark key={i} cx={x} cy={y} color={isWin ? "#a855f7" : O_CLR} />;
      })}

      {/* Win line */}
      {winCoords && <WinLine {...winCoords} />}

      {/* Click targets (on top) */}
      {board.map((cell, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect
            key={`hit-${i}`}
            x={col * CELL + 2}
            y={row * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx="12"
            fill="transparent"
            style={{ cursor: cell || gameOver ? "default" : "pointer" }}
            onMouseEnter={() => { if (!cell && !gameOver) setHovered(i); }}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { if (!cell && !gameOver) onCellClick(i); }}
          />
        );
      })}
    </svg>
  );
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
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="You (X)" value={xWins} size="sm" />
        <ScoreDisplay label="Draws" value={draws} size="sm" />
        <ScoreDisplay label="AI (O)" value={oWins} size="sm" />
      </div>

      <Board
        board={board}
        winLine={winLine}
        onCellClick={handleClick}
        gameOver={gameOver}
      />

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
