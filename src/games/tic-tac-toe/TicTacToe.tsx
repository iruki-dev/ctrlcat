import { useState, useCallback, useEffect, useRef } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { useSound } from "../../components/games/SoundContext";

type Cell = "X" | "O" | null;
type Board = Cell[];
type Difficulty = "easy" | "hard";
type PlayerMark = "X" | "O";

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

function minimax(
  board: Board,
  isMax: boolean,
  depth: number,
  aiMark: Cell,
  humanMark: Cell
): number {
  const win = getWinLine(board);
  if (win) return board[win[0]] === aiMark ? 10 - depth : depth - 10;
  if (isDraw(board)) return 0;

  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = isMax ? aiMark : humanMark;
      scores.push(minimax(board, !isMax, depth + 1, aiMark, humanMark));
      board[i] = null;
    }
  }
  return isMax ? Math.max(...scores) : Math.min(...scores);
}

function bestAiMove(board: Board, aiMark: Cell, humanMark: Cell): number {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = aiMark;
      const score = minimax(board, false, 0, aiMark, humanMark);
      board[i] = null;
      if (score > best) { best = score; move = i; }
    }
  }
  return move;
}

function randomAiMove(board: Board): number {
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
  return empty[Math.floor(Math.random() * empty.length)];
}

// SVG board constants
const BS = 300;
const CELL = BS / 3;
const INSET = 18;
const MARK_R = 30;
const X_OFF = 27;

function cellCenter(i: number) {
  return { x: (i % 3) * CELL + CELL / 2, y: Math.floor(i / 3) * CELL + CELL / 2 };
}

function getWinLineCoords(line: [number, number, number]) {
  const a = cellCenter(line[0]);
  const c = cellCenter(line[2]);
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ext = 22;
  return {
    x1: a.x - (dx / len) * ext, y1: a.y - (dy / len) * ext,
    x2: c.x + (dx / len) * ext, y2: c.y + (dy / len) * ext,
  };
}

function XMark({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setStep(1);
      setTimeout(() => setStep(2), 90);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <g>
      <line x1={cx - X_OFF} y1={cy - X_OFF} x2={cx + X_OFF} y2={cy + X_OFF}
        stroke={color} strokeWidth="5.5" strokeLinecap="round"
        pathLength="1" strokeDasharray="1"
        strokeDashoffset={step >= 1 ? 0 : 1}
        style={{ transition: "stroke-dashoffset 0.22s ease-out" }}
      />
      <line x1={cx + X_OFF} y1={cy - X_OFF} x2={cx - X_OFF} y2={cy + X_OFF}
        stroke={color} strokeWidth="5.5" strokeLinecap="round"
        pathLength="1" strokeDasharray="1"
        strokeDashoffset={step >= 2 ? 0 : 1}
        style={{ transition: "stroke-dashoffset 0.22s ease-out" }}
      />
    </g>
  );
}

function OMark({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <circle cx={cx} cy={cy} r={MARK_R} fill="none"
      stroke={color} strokeWidth="5.5" strokeLinecap="round"
      pathLength="1" strokeDasharray="1"
      strokeDashoffset={drawn ? 0 : 1}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
    />
  );
}

function WinLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="rgb(var(--game-accent) / 0.5)" strokeWidth="7" strokeLinecap="round"
      pathLength="1" strokeDasharray="1"
      strokeDashoffset={drawn ? 0 : 1}
      style={{ transition: "stroke-dashoffset 0.38s ease-out" }}
    />
  );
}

// Particle burst from a winning cell
function WinParticles({ cellIndex }: { cellIndex: number }) {
  const { x, y } = cellCenter(cellIndex);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 38 + Math.random() * 14;
    return {
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist,
      size: 3 + Math.random() * 3,
      color: i % 2 === 0 ? "rgb(var(--game-secondary))" : "rgb(var(--game-accent) / 0.5)",
    };
  });

  return (
    <>
      {particles.map((p, i) => (
        <circle
          key={i}
          cx={x} cy={y} r={p.size}
          fill={p.color}
          opacity={visible ? 0 : 0.9}
          style={{
            transform: visible ? `translate(${p.tx}px, ${p.ty}px)` : "translate(0,0)",
            transition: `transform 0.55s cubic-bezier(0.2,0.9,0.4,1) ${i * 15}ms, opacity 0.55s ease-out ${i * 15}ms`,
          }}
        />
      ))}
    </>
  );
}

// AI thinking dots indicator
function ThinkingDots() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDot(d => (d + 1) % 4), 200);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex gap-0.5 items-end h-4">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-game-accent inline-block"
          style={{
            opacity: dot > i ? 1 : 0.25,
            transition: "opacity 0.15s",
            transform: dot === i ? "translateY(-2px)" : "translateY(0)",
          }}
        />
      ))}
    </span>
  );
}

function Board({
  board, winLine, onCellClick, gameOver, playerMark, aiThinking,
}: {
  board: Board;
  winLine: [number, number, number] | null;
  onCellClick: (i: number) => void;
  gameOver: boolean;
  playerMark: PlayerMark;
  aiThinking: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const winCoords = winLine ? getWinLineCoords(winLine) : null;
  const BG = "rgb(var(--game-surface-2))";
  const GRID = "rgb(var(--game-border))";
  const X_CLR = "rgb(var(--game-accent-dim))";
  const O_CLR = "rgb(var(--game-accent))";
  const WIN_CELL_FILL = "rgb(var(--game-accent) / 0.07)";

  const isInteractive = (i: number) => !board[i] && !gameOver && !aiThinking;

  return (
    <svg
      width={BS} height={BS}
      viewBox={`0 0 ${BS} ${BS}`}
      className="w-full max-w-[320px] mx-auto block"
      style={{ touchAction: "manipulation" }}
    >
      <rect width={BS} height={BS} rx="20" fill={BG} />

      {winLine?.map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect key={`wh-${i}`}
            x={col * CELL + 4} y={row * CELL + 4}
            width={CELL - 8} height={CELL - 8}
            rx="12" fill={WIN_CELL_FILL}
          />
        );
      })}

      <line x1={CELL}     y1={INSET}      x2={CELL}        y2={BS - INSET} stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={CELL * 2} y1={INSET}      x2={CELL * 2}    y2={BS - INSET} stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={INSET}    y1={CELL}       x2={BS - INSET}  y2={CELL}       stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={INSET}    y1={CELL * 2}   x2={BS - INSET}  y2={CELL * 2}   stroke={GRID} strokeWidth="2.5" strokeLinecap="round" />

      {hovered !== null && !board[hovered] && isInteractive(hovered) && (
        <text
          x={cellCenter(hovered).x} y={cellCenter(hovered).y + 14}
          textAnchor="middle" fontSize="40" fontWeight="900"
          style={{ pointerEvents: "none", fontFamily: "system-ui, sans-serif",
                   fill: "rgb(var(--game-accent) / 0.18)" }}
        >
          {playerMark}
        </text>
      )}

      {board.map((cell, i) => {
        if (!cell) return null;
        const { x, y } = cellCenter(i);
        const isWin = winLine?.includes(i) ?? false;
        const winColor = "rgb(var(--game-secondary))";
        if (cell === "X") return <XMark key={i} cx={x} cy={y} color={isWin ? winColor : X_CLR} />;
        return <OMark key={i} cx={x} cy={y} color={isWin ? winColor : O_CLR} />;
      })}

      {winLine?.map((i) => <WinParticles key={`p-${i}`} cellIndex={i} />)}

      {winCoords && <WinLine {...winCoords} />}

      {board.map((cell, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect
            key={`hit-${i}`}
            x={col * CELL + 2} y={row * CELL + 2}
            width={CELL - 4} height={CELL - 4}
            rx="12" fill="transparent"
            style={{ cursor: isInteractive(i) ? "pointer" : "default" }}
            onMouseEnter={() => { if (isInteractive(i)) setHovered(i); }}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { if (isInteractive(i)) onCellClick(i); }}
          />
        );
      })}
    </svg>
  );
}

const messages = {
  en: {
    ...common.en,
    levels: { easy: "Easy", hard: "Hard" } as Record<Difficulty, string>,
    levelDesc: { easy: "Random AI, always beatable", hard: "Perfect AI, a draw is the best result" } as Record<Difficulty, string>,
    title: "Tic-Tac-Toe",
    tagline: "Choose your settings before starting",
    difficulty: "Difficulty",
    playAs: "You play as",
    first: "(goes first)",
    second: "(goes second)",
    win: "You win!",
    draw: "Draw!",
    lose: "AI wins.",
    winHard: "Impressive, you beat a perfect AI.",
    winEasy: "Nice work. Try Hard mode for a real challenge.",
    drawHard: "That is the best result against a perfect AI.",
    drawEasy: "A tie! See if you can win on Hard.",
    loseHard: "Corners and center are the strongest openings.",
    loseEasy: "Unlucky, try again!",
    settings: "Settings",
    youAre: (mark: string) => `You are ${mark}`,
    you: "You",
    drawLabel: "Draw",
    ai: "AI",
    thinking: "AI is thinking",
    yourTurn: (mark: string) => `Your turn, you are ${mark}`,
    changeSettings: "Change settings",
  },
  ko: {
    ...common.ko,
    levels: { easy: "쉬움", hard: "어려움" } as Record<Difficulty, string>,
    levelDesc: { easy: "무작위로 두는 AI, 언제든 이길 수 있습니다", hard: "완벽한 AI, 비기는 것이 최선입니다" } as Record<Difficulty, string>,
    title: "틱택토",
    tagline: "시작하기 전에 설정을 고르세요",
    difficulty: "난이도",
    playAs: "내 기호",
    first: "(먼저 둠)",
    second: "(나중에 둠)",
    win: "승리!",
    draw: "무승부!",
    lose: "AI가 이겼습니다.",
    winHard: "대단합니다. 완벽한 AI를 이겼습니다.",
    winEasy: "잘했습니다. 어려움 난이도에도 도전해 보세요.",
    drawHard: "완벽한 AI를 상대로는 최선의 결과입니다.",
    drawEasy: "비겼습니다! 어려움 난이도에서 이겨 보세요.",
    loseHard: "모서리와 가운데가 가장 강한 첫수입니다.",
    loseEasy: "아쉽네요. 다시 도전해 보세요!",
    settings: "설정",
    youAre: (mark: string) => `나는 ${mark}`,
    you: "나",
    drawLabel: "무승부",
    ai: "AI",
    thinking: "AI가 생각하는 중",
    yourTurn: (mark: string) => `내 차례, 나는 ${mark}`,
    changeSettings: "설정 바꾸기",
  },
};

function SetupScreen({
  onStart,
}: {
  onStart: (difficulty: Difficulty, playerMark: PlayerMark) => void;
}) {
  const m = useMessages(messages);
  const [diff, setDiff] = useState<Difficulty>("hard");
  const [mark, setMark] = useState<PlayerMark>("X");

  return (
    <div className="flex flex-col gap-5 px-4 py-5 animate-slide-up">
      <div className="text-center">
        <div className="text-xl font-black text-game-text tracking-tight">{m.title}</div>
        <div className="text-xs text-game-muted mt-1">{m.tagline}</div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-bold text-game-muted uppercase tracking-widest">{m.difficulty}</div>
        <div className="grid grid-cols-2 gap-2">
          {(["easy", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiff(d)}
              className={[
                "flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-left transition-all duration-150",
                diff === d
                  ? "border-game-accent bg-game-accent/10"
                  : "border-game-border bg-game-surface hover:border-game-accent/40",
              ].join(" ")}
            >
              <span className={`text-sm font-black ${diff === d ? "text-game-accent" : "text-game-text"}`}>
                {m.levels[d]}
              </span>
              <span className="text-[11px] text-game-muted leading-snug">{m.levelDesc[d]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-bold text-game-muted uppercase tracking-widest">{m.playAs}</div>
        <div className="grid grid-cols-2 gap-2">
          {(["X", "O"] as PlayerMark[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMark(option)}
              className={[
                "flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-sm transition-all duration-150",
                mark === option
                  ? "border-game-accent bg-game-accent/10 text-game-accent"
                  : "border-game-border bg-game-surface text-game-text hover:border-game-accent/40",
              ].join(" ")}
            >
              <span className="text-lg">{option}</span>
              <span className="text-xs font-normal text-game-muted">{option === "X" ? m.first : m.second}</span>
            </button>
          ))}
        </div>
      </div>

      <GameButton size="lg" className="w-full" onClick={() => onStart(diff, mark)}>
        {m.start}
      </GameButton>
    </div>
  );
}

export default function TicTacToe() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [playerMark, setPlayerMark] = useState<PlayerMark>("X");
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [draws, setDraws] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"player" | "ai" | "draw" | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const { play } = useSound();
  usePhaseEvents(
    phase === "setup"
      ? "idle"
      : !gameOver
        ? "playing"
        : result === "player"
          ? "won"
          : result === "ai"
            ? "lost"
            : "over",
  );

  const aiMark: Cell = playerMark === "X" ? "O" : "X";

  const finishGame = useCallback(
    (nextBoard: Board, winner: Cell | "draw") => {
      setBoard(nextBoard);
      if (winner === "draw") {
        setResult("draw");
        setDraws((n) => n + 1);
        setGameOver(true);
        play("draw");
      } else if (winner === playerMark) {
        setResult("player");
        setPlayerWins((n) => n + 1);
        setGameOver(true);
        play("win");
      } else {
        setResult("ai");
        setAiWins((n) => n + 1);
        setGameOver(true);
        play("lose");
      }
    },
    [playerMark, play]
  );

  const runAiMove = useCallback(
    (boardAfterPlayer: Board) => {
      const delay = difficulty === "hard" ? 600 : 300;
      setAiThinking(true);
      setTimeout(() => {
        setAiThinking(false);
        const aiIdx =
          difficulty === "hard"
            ? bestAiMove(boardAfterPlayer, aiMark, playerMark)
            : randomAiMove(boardAfterPlayer);
        const next = [...boardAfterPlayer];
        next[aiIdx] = aiMark;
        play("place");

        const aiWinLine = getWinLine(next);
        if (aiWinLine) {
          finishGame(next, aiMark);
        } else if (isDraw(next)) {
          finishGame(next, "draw");
        } else {
          setBoard(next);
        }
      }, delay);
    },
    [difficulty, aiMark, playerMark, play, finishGame]
  );

  // When player goes second (O), AI moves first
  const aiFirstRef = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || aiFirstRef.current) return;
    if (playerMark === "O") {
      aiFirstRef.current = true;
      runAiMove(Array(9).fill(null));
    }
  }, [phase, playerMark, runAiMove]);

  const handleStart = useCallback((diff: Difficulty, mark: PlayerMark) => {
    setDifficulty(diff);
    setPlayerMark(mark);
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setResult(null);
    setAiThinking(false);
    aiFirstRef.current = false;
    setPhase("playing");
  }, []);

  const handleClick = useCallback(
    (idx: number) => {
      if (board[idx] || gameOver || aiThinking) return;

      const next = [...board];
      next[idx] = playerMark;
      play("place");

      const winLine = getWinLine(next);
      if (winLine) {
        finishGame(next, playerMark);
        return;
      }
      if (isDraw(next)) {
        finishGame(next, "draw");
        return;
      }

      setBoard(next);
      runAiMove(next);
    },
    [board, gameOver, aiThinking, playerMark, play, finishGame, runAiMove]
  );

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setResult(null);
    setAiThinking(false);
    aiFirstRef.current = false;
    if (playerMark === "O") {
      setTimeout(() => runAiMove(Array(9).fill(null)), 0);
    }
  }, [playerMark, runAiMove]);

  const winLine = getWinLine(board);

  if (phase === "setup") {
    return <SetupScreen onStart={handleStart} />;
  }

  const hard = difficulty === "hard";
  const resultMsg = result === "player" ? m.win : result === "draw" ? m.draw : m.lose;
  const resultSub =
    result === "player"
      ? hard ? m.winHard : m.winEasy
      : result === "draw"
        ? hard ? m.drawHard : m.drawEasy
        : hard ? m.loseHard : m.loseEasy;

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-4 animate-slide-up p-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPhase("setup")}
          className="text-xs font-bold text-game-muted hover:text-game-accent transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {m.settings}
        </button>
        <span className="text-xs font-bold text-game-muted px-2 py-1 rounded-full bg-game-surface border border-game-border">
          {m.levels[difficulty]} · {m.youAre(playerMark)}
        </span>
      </div>

      {/* Score strip */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreDisplay label={m.you} value={playerWins} size="sm" />
        <ScoreDisplay label={m.drawLabel} value={draws} size="sm" />
        <ScoreDisplay label={m.ai} value={aiWins} size="sm" />
      </div>

      {/* Board card */}
      <div className="bg-game-surface rounded-3xl p-4 flex flex-col gap-3 shadow-md-1">
        <Board
          board={board}
          winLine={winLine}
          onCellClick={handleClick}
          gameOver={gameOver}
          playerMark={playerMark}
          aiThinking={aiThinking}
        />

        <div className="text-center text-sm text-game-muted h-5 flex items-center justify-center gap-2">
          {gameOver ? null : aiThinking ? (
            <>
              <span>{m.thinking}</span>
              <ThinkingDots />
            </>
          ) : (
            <span>{m.yourTurn(playerMark)}</span>
          )}
        </div>
      </div>

      {/* Result */}
      {gameOver && result && (
        <div className={[
          "rounded-2xl border-2 p-4 flex flex-col gap-1",
          result === "player"
            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950"
            : result === "draw"
              ? "border-game-border bg-game-surface"
              : "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950",
        ].join(" ")}>
          <div className={[
            "text-base font-black",
            result === "player" ? "text-green-700 dark:text-green-300"
              : result === "draw" ? "text-game-text"
                : "text-red-700 dark:text-red-300",
          ].join(" ")}>
            {resultMsg}
          </div>
          <div className="text-xs text-game-muted">{resultSub}</div>
        </div>
      )}

      {gameOver && (
        <div className="flex gap-2">
          <GameButton onClick={() => afterBreak(resetGame)} size="lg" className="flex-1">
            {m.playAgain}
          </GameButton>
          <GameButton onClick={() => setPhase("setup")} size="lg" variant="secondary" className="flex-1">
            {m.changeSettings}
          </GameButton>
        </div>
      )}
    </div>
  );
}
