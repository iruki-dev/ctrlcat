import { useState, useCallback, useRef } from "react";
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
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Guess" value={tries} />
        <ScoreDisplay label="Left" value={triesLeft} highlight={triesLeft <= 2} />
        <ScoreDisplay label="Best" value={bestScore ?? "—"} />
      </div>

      {/* Range hint visualization */}
      <RangeBar hints={hints} max={MAX} />

      {/* Result or input */}
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

      {/* History */}
      {hints.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-game-muted uppercase tracking-widest">
            History
          </div>
          <div className="flex flex-col-reverse gap-1.5">
            {hints.map((h, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                  h.result === "correct"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : h.result === "too-low"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                }`}
              >
                <span className="w-6 text-game-muted text-xs font-normal">#{i + 1}</span>
                <span className="font-mono text-lg">{h.value}</span>
                <span className="ml-auto text-xs uppercase tracking-widest">
                  {h.result === "too-low"
                    ? "↑ Too low"
                    : h.result === "too-high"
                      ? "↓ Too high"
                      : "✓ Correct"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RangeBar({ hints, max }: { hints: Hint[]; max: number }) {
  // Compute the current known range from hints
  let lo = 1;
  let hi = max;
  for (const h of hints) {
    if (h.result === "too-low") lo = Math.max(lo, h.value + 1);
    if (h.result === "too-high") hi = Math.min(hi, h.value - 1);
  }
  const loPercent = ((lo - 1) / max) * 100;
  const hiPercent = (hi / max) * 100;

  return (
    <div className="rounded-xl border-2 border-game-border bg-game-surface p-4">
      <div className="text-xs font-bold text-game-muted uppercase tracking-widest mb-3">
        Possible range
      </div>
      <div className="relative h-3 bg-game-bg rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-game-accent/30 rounded-full transition-all duration-500"
          style={{ left: `${loPercent}%`, width: `${hiPercent - loPercent}%` }}
        />
        <div
          className="absolute h-full w-1 bg-game-accent rounded-full transition-all duration-500"
          style={{ left: `${loPercent}%` }}
        />
        <div
          className="absolute h-full w-1 bg-game-secondary rounded-full transition-all duration-500"
          style={{ left: `${hiPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-game-muted mt-2">
        <span className="text-game-accent font-bold">{lo}</span>
        <span className="text-game-secondary font-bold">{hi}</span>
      </div>
    </div>
  );
}
