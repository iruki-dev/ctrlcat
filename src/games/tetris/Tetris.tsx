import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "../lib/GameCanvas";
import { useGameLoop } from "../lib/useGameLoop";
import { useKeys, useSwipe } from "../lib/useInput";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "paused" | "over" | "won";
type Matrix = number[][];

interface Piece {
  index: number;
  m: Matrix;
  x: number;
  y: number;
}

interface Theme {
  well: string;
  grid: string;
  text: string;
  textDim: string;
  accent: string;
}

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const GAP = 12;
const PANEL_X = BOARD_W + GAP;
const PANEL_W = 104;
const CANVAS_W = PANEL_X + PANEL_W;
const CANVAS_H = BOARD_H;

const WIN_LINES = 100;
const LINES_PER_LEVEL = 10;
const MAX_LEVEL = 10;
const DAS = 0.16;
const ARR = 0.045;
const CLEAR_FLASH = 0.18;
const BEST_KEY = "ctrlcat-tetris-best";

/* Seven tetrominoes, each in a square box so rotation is a plain matrix turn. */
const PIECES: Matrix[] = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
];

const COLORS = ["#22d3ee", "#60a5fa", "#fb923c", "#fbbf24", "#4ade80", "#c084fc", "#f472b6"];
const CLEAR_POINTS = [0, 100, 300, 500, 800];

const FALLBACK_THEME: Theme = {
  well: "rgb(243 240 255)",
  grid: "rgb(221 214 254)",
  text: "rgb(30 27 46)",
  textDim: "rgb(120 113 140)",
  accent: "rgb(124 58 237)",
};

/* Canvas cannot use Tailwind tokens, so the same CSS variables are read back
   from the document and refreshed once a second to follow theme changes. */
function readTheme(): Theme {
  if (typeof window === "undefined") return FALLBACK_THEME;
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return value ? `rgb(${value})` : fallback;
  };
  return {
    well: pick("--game-surface-2", FALLBACK_THEME.well),
    grid: pick("--game-border-dim", FALLBACK_THEME.grid),
    text: pick("--game-text", FALLBACK_THEME.text),
    textDim: pick("--game-text-dim", FALLBACK_THEME.textDim),
    accent: pick("--game-accent", FALLBACK_THEME.accent),
  };
}

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function shuffledBag(): number[] {
  const bag = [0, 1, 2, 3, 4, 5, 6];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

function rotateCW(m: Matrix): Matrix {
  return m[0].map((_, i) => m.map((row) => row[i]).reverse());
}

function rotateCCW(m: Matrix): Matrix {
  const n = m.length;
  return m[0].map((_, i) => m.map((row) => row[n - 1 - i]));
}

function collides(board: number[][], m: Matrix, px: number, py: number): boolean {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function dropInterval(level: number): number {
  return Math.max(0.1, 0.9 - (level - 1) * 0.08);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

interface GameState {
  board: number[][];
  piece: Piece | null;
  bag: number[];
  nextIndex: number;
  dropTimer: number;
  moveDir: number;
  dasTimer: number;
  arrTimer: number;
  clearing: number[] | null;
  clearTimer: number;
  score: number;
  lines: number;
  level: number;
  theme: Theme;
  themeTimer: number;
}

function createState(): GameState {
  const bag = shuffledBag();
  return {
    board: emptyBoard(),
    piece: null,
    nextIndex: bag.pop() as number,
    bag,
    dropTimer: 0,
    moveDir: 0,
    dasTimer: 0,
    arrTimer: 0,
    clearing: null,
    clearTimer: 0,
    score: 0,
    lines: 0,
    level: 1,
    theme: FALLBACK_THEME,
    themeTimer: 0,
  };
}

export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createState());
  const phaseRef = useRef<Phase>("idle");

  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);
  const [scale, setScale] = useState(1);

  const { held, consume } = useKeys();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BEST_KEY);
      if (stored) setBest(Number(stored) || 0);
    } catch {
      /* storage unavailable, best score stays in memory only */
    }
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 40) / CANVAS_W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const saveBest = useCallback(() => {
    const final = stateRef.current.score;
    setBest((prev) => {
      if (final <= prev) return prev;
      try {
        window.localStorage.setItem(BEST_KEY, String(final));
      } catch {
        /* storage unavailable, best score stays in memory only */
      }
      return final;
    });
  }, []);

  const takeNext = useCallback(() => {
    const s = stateRef.current;
    if (s.bag.length === 0) s.bag = shuffledBag();
    return s.bag.pop() as number;
  }, []);

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const index = s.nextIndex;
    s.nextIndex = takeNext();
    const m = PIECES[index];
    const piece: Piece = {
      index,
      m,
      x: Math.floor((COLS - m.length) / 2),
      y: 0,
    };
    if (collides(s.board, piece.m, piece.x, piece.y)) {
      s.piece = null;
      saveBest();
      goTo("over");
      return;
    }
    s.piece = piece;
    s.dropTimer = 0;
  }, [goTo, saveBest, takeNext]);

  const resolveClear = useCallback(() => {
    const s = stateRef.current;
    const rows = s.clearing ?? [];
    s.board = s.board.filter((_, r) => !rows.includes(r));
    while (s.board.length < ROWS) s.board.unshift(new Array(COLS).fill(0));
    s.lines += rows.length;
    s.score += CLEAR_POINTS[rows.length] * s.level;
    s.level = Math.min(MAX_LEVEL, Math.floor(s.lines / LINES_PER_LEVEL) + 1);
    s.clearing = null;
    s.clearTimer = 0;
    setScore(s.score);
    setLines(s.lines);
    setLevel(s.level);
    if (s.lines >= WIN_LINES) {
      saveBest();
      goTo("won");
      return;
    }
    spawn();
  }, [goTo, saveBest, spawn]);

  const lockPiece = useCallback(() => {
    const s = stateRef.current;
    const p = s.piece;
    if (!p) return;
    for (let r = 0; r < p.m.length; r++) {
      for (let c = 0; c < p.m[r].length; c++) {
        if (!p.m[r][c]) continue;
        const y = p.y + r;
        const x = p.x + c;
        if (y >= 0) s.board[y][x] = p.index + 1;
      }
    }
    s.piece = null;
    const full: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (s.board[r].every((v) => v !== 0)) full.push(r);
    }
    if (full.length > 0) {
      s.clearing = full;
      s.clearTimer = 0;
      return;
    }
    spawn();
  }, [spawn]);

  const move = useCallback((dx: number) => {
    const s = stateRef.current;
    if (!s.piece || s.clearing) return;
    if (!collides(s.board, s.piece.m, s.piece.x + dx, s.piece.y)) s.piece.x += dx;
  }, []);

  const rotate = useCallback((dir: number) => {
    const s = stateRef.current;
    const p = s.piece;
    if (!p || s.clearing) return;
    const m = dir > 0 ? rotateCW(p.m) : rotateCCW(p.m);
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!collides(s.board, m, p.x + dx, p.y)) {
        p.m = m;
        p.x += dx;
        return;
      }
    }
    /* Last resort: lift the piece one row, which frees rotations against the floor. */
    for (const dx of [0, -1, 1]) {
      if (!collides(s.board, m, p.x + dx, p.y - 1)) {
        p.m = m;
        p.x += dx;
        p.y -= 1;
        return;
      }
    }
  }, []);

  /* Moves the piece down one row. Returns false when it landed and locked. */
  const stepDown = useCallback((soft: boolean) => {
    const s = stateRef.current;
    const p = s.piece;
    if (!p || s.clearing) return false;
    if (collides(s.board, p.m, p.x, p.y + 1)) {
      lockPiece();
      return false;
    }
    p.y += 1;
    if (soft) {
      s.score += 1;
      setScore(s.score);
    }
    return true;
  }, [lockPiece]);

  const hardDrop = useCallback(() => {
    const s = stateRef.current;
    const p = s.piece;
    if (!p || s.clearing) return;
    let dist = 0;
    while (!collides(s.board, p.m, p.x, p.y + 1)) {
      p.y += 1;
      dist += 1;
    }
    s.score += dist * 2;
    setScore(s.score);
    lockPiece();
  }, [lockPiece]);

  const startGame = useCallback(() => {
    stateRef.current = createState();
    stateRef.current.theme = readTheme();
    setScore(0);
    setLines(0);
    setLevel(1);
    goTo("playing");
    spawn();
  }, [goTo, spawn]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") goTo("paused");
    else if (phaseRef.current === "paused") goTo("playing");
  }, [goTo]);

  const quit = useCallback(() => {
    saveBest();
    goTo("idle");
  }, [goTo, saveBest]);

  useSwipe((dir) => {
    if (phaseRef.current !== "playing") return;
    if (dir === "left") move(-1);
    else if (dir === "right") move(1);
    else if (dir === "up") rotate(1);
    else hardDrop();
  });

  useGameLoop(
    canvasRef,
    {
      update(dt) {
        const s = stateRef.current;

        s.themeTimer += dt;
        if (s.themeTimer > 1) {
          s.theme = readTheme();
          s.themeTimer = 0;
        }

        if (consume("p") || consume("P") || consume("Escape")) togglePause();
        if (phaseRef.current !== "playing") return;

        if (s.clearing) {
          s.clearTimer += dt;
          if (s.clearTimer >= CLEAR_FLASH) resolveClear();
          return;
        }
        if (!s.piece) return;

        /* Every fresh key press moves once, even a tap shorter than one frame.
           Holding the key then repeats after a short delay. */
        let tapped = 0;
        if (consume("ArrowLeft")) tapped = -1;
        if (consume("ArrowRight")) tapped = 1;
        if (tapped !== 0) {
          move(tapped);
          s.moveDir = tapped;
          s.dasTimer = 0;
          s.arrTimer = 0;
        } else {
          const left = held.current.has("ArrowLeft");
          const right = held.current.has("ArrowRight");
          const dir = left && !right ? -1 : right && !left ? 1 : 0;
          if (dir !== s.moveDir) {
            s.moveDir = dir;
            s.dasTimer = 0;
            s.arrTimer = 0;
          } else if (dir !== 0) {
            s.dasTimer += dt;
            if (s.dasTimer >= DAS) {
              s.arrTimer += dt;
              while (s.arrTimer >= ARR) {
                s.arrTimer -= ARR;
                move(dir);
              }
            }
          }
        }

        if (consume("ArrowUp") || consume("x") || consume("X")) rotate(1);
        if (consume("z") || consume("Z")) rotate(-1);
        if (consume(" ")) {
          hardDrop();
          return;
        }

        const soft = held.current.has("ArrowDown");
        const interval = soft ? Math.max(0.025, dropInterval(s.level) / 10) : dropInterval(s.level);
        s.dropTimer += dt;
        while (s.dropTimer >= interval) {
          s.dropTimer -= interval;
          if (!stepDown(soft)) break;
        }
      },

      draw(ctx, width, height) {
        const s = stateRef.current;
        const t = s.theme;
        ctx.clearRect(0, 0, width, height);

        roundRect(ctx, 0, 0, BOARD_W, BOARD_H, 10);
        ctx.fillStyle = t.well;
        ctx.fill();

        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.08;
        for (let c = 1; c < COLS; c++) {
          ctx.beginPath();
          ctx.moveTo(c * CELL + 0.5, 0);
          ctx.lineTo(c * CELL + 0.5, BOARD_H);
          ctx.stroke();
        }
        for (let r = 1; r < ROWS; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * CELL + 0.5);
          ctx.lineTo(BOARD_W, r * CELL + 0.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const drawCell = (x: number, y: number, color: string, size = CELL) => {
          roundRect(ctx, x + 1, y + 1, size - 2, size - 2, size / 5);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
          ctx.fillRect(x + size / 6, y + size / 6, size - size / 3, Math.max(2, size / 8));
        };

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const v = s.board[r][c];
            if (v) drawCell(c * CELL, r * CELL, COLORS[v - 1]);
          }
        }

        const p = s.piece;
        if (p) {
          /* Ghost: where the piece would land if dropped right now. */
          let gy = p.y;
          while (!collides(s.board, p.m, p.x, gy + 1)) gy += 1;
          ctx.strokeStyle = COLORS[p.index];
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 2;
          for (let r = 0; r < p.m.length; r++) {
            for (let c = 0; c < p.m[r].length; c++) {
              if (!p.m[r][c]) continue;
              const y = gy + r;
              if (y < 0) continue;
              roundRect(ctx, (p.x + c) * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4, 4);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;

          for (let r = 0; r < p.m.length; r++) {
            for (let c = 0; c < p.m[r].length; c++) {
              if (!p.m[r][c]) continue;
              const y = p.y + r;
              if (y < 0) continue;
              drawCell((p.x + c) * CELL, y * CELL, COLORS[p.index]);
            }
          }
        }

        if (s.clearing) {
          const k = Math.min(1, s.clearTimer / CLEAR_FLASH);
          const inset = (CELL / 2) * k;
          ctx.fillStyle = t.accent;
          ctx.globalAlpha = 1 - k * 0.7;
          for (const r of s.clearing) {
            ctx.fillRect(0, r * CELL + inset, BOARD_W, CELL - inset * 2);
          }
          ctx.globalAlpha = 1;
        }

        /* Side panel: next piece, level, lines and progress toward the win. */
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        const label = (text: string, y: number) => {
          ctx.fillStyle = t.textDim;
          ctx.font = "600 10px Roboto, Inter, system-ui, sans-serif";
          ctx.fillText(text, PANEL_X, y);
        };
        const value = (text: string, y: number) => {
          ctx.fillStyle = t.text;
          ctx.font = "700 22px Roboto, Inter, system-ui, sans-serif";
          ctx.fillText(text, PANEL_X, y);
        };

        label("NEXT", 2);
        roundRect(ctx, PANEL_X, 18, PANEL_W, 74, 10);
        ctx.fillStyle = t.well;
        ctx.fill();

        const nm = PIECES[s.nextIndex];
        const mini = 17;
        let minC = nm.length;
        let maxC = -1;
        let minR = nm.length;
        let maxR = -1;
        for (let r = 0; r < nm.length; r++) {
          for (let c = 0; c < nm[r].length; c++) {
            if (!nm[r][c]) continue;
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
          }
        }
        const pw = (maxC - minC + 1) * mini;
        const ph = (maxR - minR + 1) * mini;
        const ox = PANEL_X + (PANEL_W - pw) / 2;
        const oy = 18 + (74 - ph) / 2;
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            if (!nm[r][c]) continue;
            drawCell(ox + (c - minC) * mini, oy + (r - minR) * mini, COLORS[s.nextIndex], mini);
          }
        }

        label("LEVEL", 110);
        value(String(s.level), 124);
        label("LINES", 164);
        value(String(s.lines), 178);
        label("TO WIN", 218);
        value(String(Math.max(0, WIN_LINES - s.lines)), 232);

        roundRect(ctx, PANEL_X, 274, PANEL_W, 6, 3);
        ctx.fillStyle = t.grid;
        ctx.fill();
        const progress = Math.min(1, s.lines / WIN_LINES);
        if (progress > 0) {
          roundRect(ctx, PANEL_X, 274, Math.max(6, PANEL_W * progress), 6, 3);
          ctx.fillStyle = t.accent;
          ctx.fill();
        }

        if (phaseRef.current === "paused") {
          roundRect(ctx, 0, 0, BOARD_W, BOARD_H, 10);
          ctx.fillStyle = t.well;
          ctx.globalAlpha = 0.88;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.textAlign = "center";
          ctx.fillStyle = t.text;
          ctx.font = "700 24px Roboto, Inter, system-ui, sans-serif";
          ctx.fillText("Paused", BOARD_W / 2, BOARD_H / 2 - 22);
          ctx.fillStyle = t.textDim;
          ctx.font = "400 13px Roboto, Inter, system-ui, sans-serif";
          ctx.fillText("Press P to resume", BOARD_W / 2, BOARD_H / 2 + 12);
          ctx.textAlign = "left";
        }
      },
    },
    phase === "playing" || phase === "paused"
  );

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Falling blocks stack up in a well that is ten columns wide. Slide and turn each piece so
            every gap in a row gets filled, and the row disappears.
          </p>
          <p className="text-game-text-dim">
            Clear one hundred rows to win. Let the stack reach the top and the game ends.
          </p>
        </div>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
        {best > 0 && <ScoreDisplay label="Best" value={best} />}
      </div>
    );
  }

  if (phase === "over" || phase === "won") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Score" value={score} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Rows cleared" value={lines} />
          <ScoreDisplay label="Best" value={Math.max(best, score)} />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? "One hundred rows cleared. You finished the last level."
            : "The stack reached the top."}
        </GameMessage>
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Best" value={best > 0 ? best : "—"} />
      </div>

      <div className="flex justify-center">
        <GameCanvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          cssWidth={Math.round(CANVAS_W * scale)}
          cssHeight={Math.round(CANVAS_H * scale)}
          className="rounded-2xl border-2 border-game-border bg-game-surface"
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        <GameButton variant="secondary" size="sm" onClick={() => move(-1)} aria-label="Move left">
          Left
        </GameButton>
        <GameButton variant="secondary" size="sm" onClick={() => rotate(1)} aria-label="Rotate">
          Turn
        </GameButton>
        <GameButton variant="secondary" size="sm" onClick={() => move(1)} aria-label="Move right">
          Right
        </GameButton>
        <GameButton variant="secondary" size="sm" onClick={() => stepDown(true)} aria-label="Move down one row">
          Down
        </GameButton>
        <GameButton variant="primary" size="sm" onClick={hardDrop} aria-label="Drop to the bottom">
          Drop
        </GameButton>
      </div>

      <p className="text-center text-xs text-game-text-dim">
        Arrow keys move and turn the piece, space drops it, P pauses. On a touch screen, swipe to
        move, swipe up to turn and swipe down to drop.
      </p>

      <div className="flex justify-center gap-2">
        <GameButton variant="ghost" size="sm" onClick={togglePause}>
          {phase === "paused" ? "Resume" : "Pause"}
        </GameButton>
        <GameButton variant="ghost" size="sm" onClick={quit}>
          Quit
        </GameButton>
      </div>
    </div>
  );
}
