import { useCallback, useEffect, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won" | "lost";

const COLS = 4;
const PAIRS = 8;
const TOTAL = PAIRS * 2;
const ROWS = TOTAL / COLS;
const MAX_ATTEMPTS = 20;
const MISS_MS = 800;
const HIT_MS = 400;

interface Card {
  id: number;
  sym: number;
}

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (let s = 0; s < PAIRS; s++) {
    cards.push({ id: s * 2, sym: s });
    cards.push({ id: s * 2 + 1, sym: s });
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}

const shapes = [
  <circle cx="12" cy="12" r="8" fill="currentColor" />,
  <rect
    x="5"
    y="5"
    width="14"
    height="14"
    rx="2"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  />,
  <path d="M12 4 L20.5 19.5 H3.5 Z" fill="currentColor" />,
  <path
    d="M12 3 L20.5 12 L12 21 L3.5 12 Z"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinejoin="round"
  />,
  <path
    d="M12 2.8 L14.7 9.5 L21.8 10 L16.4 14.7 L18.1 21.6 L12 17.8 L5.9 21.6 L7.6 14.7 L2.2 10 L9.3 9.5 Z"
    fill="currentColor"
  />,
  <path
    d="M9.5 3 h5 v6.5 H21 v5 h-6.5 V21 h-5 v-6.5 H3 v-5 h6.5 Z"
    fill="currentColor"
  />,
  <path
    d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinejoin="round"
  />,
  <path
    d="M5.6 3.5 L12 9.9 L18.4 3.5 L20.5 5.6 L14.1 12 L20.5 18.4 L18.4 20.5 L12 14.1 L5.6 20.5 L3.5 18.4 L9.9 12 L3.5 5.6 Z"
    fill="currentColor"
  />,
];

function CardFace({ sym }: { sym: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-8 h-8 sm:w-9 sm:h-9 ${
        sym % 2 === 0 ? "text-game-accent" : "text-game-secondary"
      }`}
      aria-hidden="true"
    >
      {shapes[sym]}
    </svg>
  );
}

export default function MemoryMatch() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const pairsFound = matched.length / 2;
  const attemptsLeft = MAX_ATTEMPTS - attempts;
  const score = pairsFound * 100 + Math.max(0, attemptsLeft) * 25;

  const startGame = useCallback(() => {
    setDeck(buildDeck());
    setFlipped([]);
    setMatched([]);
    setAttempts(0);
    setCursor(0);
    setPhase("playing");
  }, []);

  const flip = useCallback(
    (i: number) => {
      if (phase !== "playing") return;
      if (flipped.length === 2) return;
      if (flipped.includes(i) || matched.includes(i)) return;
      const next = [...flipped, i];
      setFlipped(next);
      if (next.length === 2) setAttempts((a) => a + 1);
    },
    [phase, flipped, matched],
  );

  // Resolve a revealed pair after a short pause.
  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const hit = deck[a].sym === deck[b].sym;
    const timer = setTimeout(
      () => {
        if (hit) setMatched((prev) => [...prev, a, b]);
        setFlipped([]);
      },
      hit ? HIT_MS : MISS_MS,
    );
    return () => clearTimeout(timer);
  }, [flipped, deck]);

  // Win / lose check, once the board has settled.
  useEffect(() => {
    if (phase !== "playing" || flipped.length > 0) return;
    if (matched.length === TOTAL) {
      setPhase("won");
      setBestScore((b) => (b === null || score > b ? score : b));
    } else if (attempts >= MAX_ATTEMPTS) {
      setPhase("lost");
    }
  }, [phase, flipped, matched, attempts, score]);

  // Keyboard play: arrows move the highlight, Enter or Space flips.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => {
          const row = Math.floor(c / COLS);
          const col = c % COLS;
          if (k === "ArrowLeft") return row * COLS + ((col + COLS - 1) % COLS);
          if (k === "ArrowRight") return row * COLS + ((col + 1) % COLS);
          if (k === "ArrowUp") return ((row + ROWS - 1) % ROWS) * COLS + col;
          return ((row + 1) % ROWS) * COLS + col;
        });
      } else if (k === "Enter" || k === " ") {
        e.preventDefault();
        flip(cursor);
      } else if (k === "Escape") {
        setPhase("idle");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, cursor, flip]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          Sixteen cards lie face down in eight matching pairs. Turn two cards at a time
          and remember what you saw. Clear every pair within {MAX_ATTEMPTS} turns to win,
          and the turns you save are worth extra points.
        </p>
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
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Pairs" value={`${pairsFound} / ${PAIRS}`} size="sm" />
          <ScoreDisplay label="Turns used" value={attempts} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `All pairs cleared with ${attemptsLeft} turns to spare.`
            : "Out of turns. The board still had pairs left."}
        </GameMessage>
        {bestScore !== null && (
          <p className="text-sm text-game-muted">Best score this session: {bestScore}</p>
        )}
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Pairs" value={`${pairsFound}/${PAIRS}`} />
        <ScoreDisplay label="Turns left" value={attemptsLeft} />
      </div>

      <div
        className="grid grid-cols-4 gap-2 sm:gap-3 select-none"
        role="grid"
        aria-label="Memory board"
      >
        {deck.map((card, i) => {
          const isMatched = matched.includes(i);
          const isUp = isMatched || flipped.includes(i);
          return (
            <button
              key={card.id}
              type="button"
              tabIndex={-1}
              aria-label={
                isUp ? `Card ${i + 1}, shape ${card.sym + 1}` : `Card ${i + 1}, face down`
              }
              onClick={() => {
                setCursor(i);
                flip(i);
              }}
              onMouseEnter={() => setCursor(i)}
              className={`relative aspect-square rounded-xl [perspective:800px] focus:outline-none transition-opacity duration-300 ${
                cursor === i ? "ring-2 ring-game-accent ring-offset-2 ring-offset-game-bg" : ""
              } ${isMatched ? "opacity-60" : "hover:-translate-y-0.5 transition-transform"}`}
            >
              <div
                className={`relative w-full h-full transition-transform duration-300 [transform-style:preserve-3d] ${
                  isUp ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                <div className="absolute inset-0 rounded-xl bg-game-accent border-2 border-game-accent-dim [backface-visibility:hidden] flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full border-2 border-game-accent-light" />
                </div>
                <div
                  className={`absolute inset-0 rounded-xl border-2 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched
                      ? "bg-game-accent-light border-game-accent"
                      : "bg-game-surface border-game-border"
                  }`}
                >
                  <CardFace sym={card.sym} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-game-muted">
        Click a card, or use the arrow keys and Enter. Escape quits.
      </p>

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        Quit
      </GameButton>
    </div>
  );
}
