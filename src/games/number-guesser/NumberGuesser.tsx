import { useState, useCallback, useRef, useEffect } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameInput } from "../../components/games/ui/Input";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

const MAX = 100;
const MAX_TRIES = 7;

type Phase = "playing" | "won" | "lost";
type Hint = { value: number; result: "too-low" | "too-high" | "correct" };

function newSecret() {
  return Math.floor(Math.random() * MAX) + 1;
}

const HINT_CLASSES: Record<Hint["result"], { wrap: string; num: string; arrow: string; label: string }> = {
  correct: {
    wrap:  "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950",
    num:   "text-green-700 dark:text-green-300",
    arrow: "text-green-600 dark:text-green-400",
    label: "text-green-600 dark:text-green-400",
  },
  "too-low": {
    wrap:  "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950",
    num:   "text-blue-700 dark:text-blue-300",
    arrow: "text-blue-600 dark:text-blue-400",
    label: "text-blue-600 dark:text-blue-400",
  },
  "too-high": {
    wrap:  "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950",
    num:   "text-orange-700 dark:text-orange-300",
    arrow: "text-orange-600 dark:text-orange-400",
    label: "text-orange-600 dark:text-orange-400",
  },
};

function AnimatedHintItem({ hint, index, isNew }: { hint: Hint; index: number; isNew: boolean }) {
  const [visible, setVisible] = useState(!isNew);

  useEffect(() => {
    if (!isNew) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [isNew]);

  const c = HINT_CLASSES[hint.result];
  const dirLabel = hint.result === "too-low" ? "Go higher" : hint.result === "too-high" ? "Go lower" : "Correct!";
  const arrow    = hint.result === "too-low" ? "↑" : hint.result === "too-high" ? "↓" : null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-bold ${c.wrap}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.22s ease-out, transform 0.22s ease-out",
      }}
    >
      <span className={`w-5 text-xs font-normal opacity-60 ${c.num}`}>#{index + 1}</span>
      <span className={`font-mono text-xl font-black tabular-nums ${c.num}`}>{hint.value}</span>
      {arrow && <span className={`text-base font-black ${c.arrow}`}>{arrow}</span>}
      <span className={`ml-auto text-xs uppercase tracking-widest font-bold ${c.label}`}>{dirLabel}</span>
    </div>
  );
}

export default function NumberGuesser() {
  const [secret, setSecret] = useState(newSecret);
  const [input, setInput] = useState("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [bestScore, setBestScore] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tries = hints.length;
  const triesLeft = MAX_TRIES - tries;

  const reset = useCallback(() => {
    setSecret(newSecret());
    setHints([]);
    setInput("");
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleGuess = () => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > MAX) return;

    const hint: Hint = {
      value: n,
      result: n < secret ? "too-low" : n > secret ? "too-high" : "correct",
    };
    const nextHints = [...hints, hint];
    setHints(nextHints);
    setInput("");

    if (hint.result === "correct") {
      setPhase("won");
      const score = nextHints.length;
      if (bestScore === null || score < bestScore) setBestScore(score);
    } else if (nextHints.length >= MAX_TRIES) {
      setPhase("lost");
    }
  };

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-slide-up">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Guess" value={tries} />
        <ScoreDisplay label="Left" value={triesLeft} highlight={triesLeft <= 2} />
        <ScoreDisplay label="Best" value={bestScore ?? "—"} />
      </div>

      <RangeBar hints={hints} max={MAX} />

      {phase === "won" && (
        <div className="flex flex-col gap-4">
          <GameMessage type="success">
            Correct! The number was <strong>{secret}</strong>. You got it in{" "}
            <strong>{tries}</strong> {tries === 1 ? "try" : "tries"}!
          </GameMessage>
          <GameButton onClick={reset} size="lg" className="w-full">
            Play again
          </GameButton>
        </div>
      )}

      {phase === "lost" && (
        <div className="flex flex-col gap-4">
          <GameMessage type="error">
            Out of tries! The number was <strong>{secret}</strong>.
          </GameMessage>
          <GameButton onClick={reset} size="lg" className="w-full">
            Try again
          </GameButton>
        </div>
      )}

      {phase === "playing" && (
        <div className="flex flex-col gap-3">
          <GameInput
            ref={inputRef}
            label={`Guess a number (1–${MAX})`}
            type="number"
            min={1}
            max={MAX}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuess()}
            placeholder="?"
            hint={`${MAX_TRIES} tries total`}
          />
          <GameButton
            onClick={handleGuess}
            size="lg"
            className="w-full"
            disabled={input === ""}
          >
            Guess
          </GameButton>
        </div>
      )}

      {hints.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-game-muted uppercase tracking-widest">
            History
          </div>
          <div className="flex flex-col-reverse gap-1.5">
            {hints.map((h, i) => (
              <AnimatedHintItem
                key={i}
                hint={h}
                index={i}
                isNew={i === hints.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RangeBar({ hints, max }: { hints: Hint[]; max: number }) {
  let lo = 1;
  let hi = max;
  for (const h of hints) {
    if (h.result === "too-low")  lo = Math.max(lo, h.value + 1);
    if (h.result === "too-high") hi = Math.min(hi, h.value - 1);
  }
  const loPercent = ((lo - 1) / max) * 100;
  const hiPercent = (hi / max) * 100;
  const rangeWidth = hiPercent - loPercent;

  return (
    <div className="rounded-2xl border-2 border-game-border bg-game-surface p-4 flex flex-col gap-3">
      <div className="text-xs font-bold text-game-muted uppercase tracking-widest">
        Possible range
      </div>

      {/* Bar */}
      <div className="relative h-4 bg-game-bg rounded-full overflow-visible">
        {/* Eliminated zones */}
        <div
          className="absolute inset-y-0 left-0 bg-game-border/60 rounded-l-full"
          style={{ width: `${loPercent}%`, transition: "width 0.4s ease-out" }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-game-border/60 rounded-r-full"
          style={{ left: `${hiPercent}%`, transition: "left 0.4s ease-out" }}
        />

        {/* Active range */}
        <div
          className="absolute inset-y-0 bg-game-accent/25 rounded-full"
          style={{
            left: `${loPercent}%`,
            width: `${rangeWidth}%`,
            transition: "left 0.4s ease-out, width 0.4s ease-out",
          }}
        />

        {/* Past guess markers */}
        {hints.map((h, i) => {
          const pct = ((h.value - 1) / max) * 100;
          const color =
            h.result === "correct"
              ? "#16a34a"
              : h.result === "too-low"
                ? "#2563eb"
                : "#ea580c";
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-5 rounded-full"
              style={{
                left: `${pct}%`,
                backgroundColor: color,
                opacity: 0.7,
                transition: "left 0.3s ease-out",
              }}
            />
          );
        })}

        {/* Range edge indicators */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-full rounded-full bg-game-accent"
          style={{ left: `${loPercent}%`, transition: "left 0.4s ease-out" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-full rounded-full bg-game-secondary"
          style={{ left: `${hiPercent}%`, transition: "left 0.4s ease-out" }}
        />
      </div>

      {/* Range labels */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-game-muted uppercase tracking-widest font-bold">Low</span>
          <span
            className="text-lg font-black tabular-nums text-game-accent"
            style={{ transition: "all 0.3s ease-out" }}
          >
            {lo}
          </span>
        </div>
        <div className="text-xs text-game-muted font-medium">
          {hi - lo + 1} {hi - lo + 1 === 1 ? "number" : "numbers"} left
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-game-muted uppercase tracking-widest font-bold">High</span>
          <span
            className="text-lg font-black tabular-nums text-game-secondary"
            style={{ transition: "all 0.3s ease-out" }}
          >
            {hi}
          </span>
        </div>
      </div>
    </div>
  );
}
