import { useState, useCallback, useRef, useEffect } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameInput } from "../../components/games/ui/Input";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { useSound } from "../../components/games/SoundContext";

type Phase = "setup" | "playing" | "won" | "lost";
type Difficulty = "easy" | "normal" | "hard" | "expert";
type HintResult = "too-low" | "too-high" | "correct";

interface GuessHint {
  value: number;
  result: HintResult;
  temp: Temperature;
}

type Temperature = "burning" | "hot" | "warm" | "cool" | "cold" | "freezing";

const DIFF_CONFIG: Record<Difficulty, { label: string; max: number; tries: number; desc: string }> = {
  easy:   { label: "Easy",   max: 50,  tries: 8,  desc: "1–50, 8 tries" },
  normal: { label: "Normal", max: 100, tries: 7,  desc: "1–100, 7 tries" },
  hard:   { label: "Hard",   max: 200, tries: 8,  desc: "1–200, 8 tries" },
  expert: { label: "Expert", max: 999, tries: 10, desc: "1–999, 10 tries" },
};

const TEMP_CONFIG: Record<Temperature, { label: string; color: string; bg: string; border: string }> = {
  burning: { label: "Burning!", color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950",     border: "border-red-300 dark:border-red-700" },
  hot:     { label: "Hot",      color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950", border: "border-orange-300 dark:border-orange-700" },
  warm:    { label: "Warm",     color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950", border: "border-yellow-300 dark:border-yellow-700" },
  cool:    { label: "Cool",     color: "text-sky-600 dark:text-sky-400",    bg: "bg-sky-50 dark:bg-sky-950",      border: "border-sky-300 dark:border-sky-700" },
  cold:    { label: "Cold",     color: "text-blue-600 dark:text-blue-400",  bg: "bg-blue-50 dark:bg-blue-950",    border: "border-blue-300 dark:border-blue-700" },
  freezing:{ label: "Freezing", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950", border: "border-indigo-300 dark:border-indigo-700" },
};

function getTemperature(guess: number, secret: number, max: number): Temperature {
  const dist = Math.abs(guess - secret);
  const pct = dist / max;
  if (pct <= 0.02) return "burning";
  if (pct <= 0.06) return "hot";
  if (pct <= 0.12) return "warm";
  if (pct <= 0.22) return "cool";
  if (pct <= 0.40) return "cold";
  return "freezing";
}

function newSecret(max: number) {
  return Math.floor(Math.random() * max) + 1;
}

function AnimatedHintItem({
  hint, index, isNew, tries,
}: {
  hint: GuessHint;
  index: number;
  isNew: boolean;
  tries: number;
}) {
  const [visible, setVisible] = useState(!isNew);
  useEffect(() => {
    if (!isNew) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [isNew]);

  const tc = TEMP_CONFIG[hint.temp];
  const dirLabel = hint.result === "too-low" ? "Too low" : hint.result === "too-high" ? "Too high" : "Correct!";
  const arrow = hint.result === "too-low" ? "↑" : hint.result === "too-high" ? "↓" : null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-bold ${tc.bg} ${tc.border}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.22s ease-out, transform 0.22s ease-out",
      }}
    >
      <span className={`w-5 text-xs font-normal opacity-60 ${tc.color}`}>#{index + 1}</span>
      <span className={`font-mono text-xl font-black tabular-nums ${tc.color}`}>{hint.value}</span>
      {arrow && <span className={`text-base font-black ${tc.color}`}>{arrow}</span>}
      <span className={`text-xs font-black uppercase tracking-wide ${tc.color}`}>{tc.label}</span>
      <span className={`ml-auto text-xs opacity-70 ${tc.color}`}>{dirLabel}</span>
    </div>
  );
}

function TempMeter({ temp }: { temp: Temperature | null }) {
  const order: Temperature[] = ["freezing", "cold", "cool", "warm", "hot", "burning"];
  const idx = temp ? order.indexOf(temp) : -1;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-bold text-game-muted uppercase tracking-widest">Temperature</div>
      <div className="flex gap-1 h-7 items-end">
        {order.map((t, i) => {
          const active = idx >= 0 && i <= idx;
          const isCurrent = i === idx;
          const heights = ["h-2", "h-3", "h-4", "h-5", "h-6", "h-7"];
          const activeColors = ["bg-indigo-400", "bg-blue-400", "bg-sky-400", "bg-yellow-400", "bg-orange-400", "bg-red-500"];
          return (
            <div
              key={t}
              className={[
                "flex-1 rounded-full transition-all duration-500",
                heights[i],
                active ? activeColors[i] : "bg-game-border",
                isCurrent ? "ring-2 ring-offset-1 ring-game-accent ring-offset-game-bg" : "",
              ].join(" ")}
              style={{ transform: isCurrent ? "scaleY(1.15)" : "scaleY(1)" }}
            />
          );
        })}
      </div>
      {temp && (
        <div className={`text-xs font-bold text-center ${TEMP_CONFIG[temp].color}`}>
          {TEMP_CONFIG[temp].label}
        </div>
      )}
    </div>
  );
}

function SetupScreen({
  bestScores,
  onStart,
}: {
  bestScores: Partial<Record<Difficulty, number>>;
  onStart: (d: Difficulty) => void;
}) {
  const [selected, setSelected] = useState<Difficulty>("normal");

  return (
    <div className="flex flex-col gap-5 px-4 py-5 animate-slide-up">
      <div className="text-center">
        <div className="text-xl font-black text-game-text tracking-tight">Number Guesser</div>
        <div className="text-xs text-game-muted mt-1">Pick the secret number in the fewest tries</div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-bold text-game-muted uppercase tracking-widest">Difficulty</div>
        <div className="grid grid-cols-2 gap-2">
          {(["easy", "normal", "hard", "expert"] as Difficulty[]).map((d) => {
            const cfg = DIFF_CONFIG[d];
            const best = bestScores[d];
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={[
                  "flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-left transition-all duration-150",
                  selected === d
                    ? "border-game-accent bg-game-accent/10"
                    : "border-game-border bg-game-surface hover:border-game-accent/40",
                ].join(" ")}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-sm font-black ${selected === d ? "text-game-accent" : "text-game-text"}`}>
                    {cfg.label}
                  </span>
                  {best != null && (
                    <span className="text-[10px] font-bold text-game-muted bg-game-surface-2 px-1.5 py-0.5 rounded-full">
                      Best: {best}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-game-muted">{cfg.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <GameButton size="lg" className="w-full" onClick={() => onStart(selected)}>
        Start game
      </GameButton>
    </div>
  );
}

function RangeBar({ hints, max }: { hints: GuessHint[]; max: number }) {
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
      <div className="text-xs font-bold text-game-muted uppercase tracking-widest">Possible range</div>

      <div className="relative h-4 bg-game-bg rounded-full overflow-visible">
        <div className="absolute inset-y-0 left-0 bg-game-border/60 rounded-l-full"
          style={{ width: `${loPercent}%`, transition: "width 0.4s ease-out" }} />
        <div className="absolute inset-y-0 right-0 bg-game-border/60 rounded-r-full"
          style={{ left: `${hiPercent}%`, transition: "left 0.4s ease-out" }} />
        <div className="absolute inset-y-0 bg-game-accent/25 rounded-full"
          style={{ left: `${loPercent}%`, width: `${rangeWidth}%`, transition: "left 0.4s ease-out, width 0.4s ease-out" }} />

        {hints.map((h, i) => {
          const pct = ((h.value - 1) / max) * 100;
          const color = h.result === "correct" ? "#16a34a" : h.result === "too-low" ? "#2563eb" : "#ea580c";
          return (
            <div key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-5 rounded-full"
              style={{ left: `${pct}%`, backgroundColor: color, opacity: 0.7, transition: "left 0.3s ease-out" }}
            />
          );
        })}

        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-full rounded-full bg-game-accent"
          style={{ left: `${loPercent}%`, transition: "left 0.4s ease-out" }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-full rounded-full bg-game-secondary"
          style={{ left: `${hiPercent}%`, transition: "left 0.4s ease-out" }} />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-game-muted uppercase tracking-widest font-bold">Low</span>
          <span className="text-lg font-black tabular-nums text-game-accent" style={{ transition: "all 0.3s ease-out" }}>{lo}</span>
        </div>
        <div className="text-xs text-game-muted font-medium">
          {hi - lo + 1} {hi - lo + 1 === 1 ? "number" : "numbers"} left
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-game-muted uppercase tracking-widest font-bold">High</span>
          <span className="text-lg font-black tabular-nums text-game-secondary" style={{ transition: "all 0.3s ease-out" }}>{hi}</span>
        </div>
      </div>
    </div>
  );
}

export default function NumberGuesser() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [secret, setSecret] = useState(0);
  const [input, setInput] = useState("");
  const [hints, setHints] = useState<GuessHint[]>([]);
  const [bestScores, setBestScores] = useState<Partial<Record<Difficulty, number>>>({});
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { play } = useSound();

  const cfg = DIFF_CONFIG[difficulty];
  const tries = hints.length;
  const triesLeft = cfg.tries - tries;
  const lastTemp = hints.length > 0 ? hints[hints.length - 1].temp : null;

  const handleStart = useCallback((d: Difficulty) => {
    setDifficulty(d);
    setSecret(newSecret(DIFF_CONFIG[d].max));
    setHints([]);
    setInput("");
    setNewBest(false);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleGuess = () => {
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > cfg.max) return;

    const result: HintResult = n < secret ? "too-low" : n > secret ? "too-high" : "correct";
    const temp = getTemperature(n, secret, cfg.max);
    const hint: GuessHint = { value: n, result, temp };
    const nextHints = [...hints, hint];
    setHints(nextHints);
    setInput("");

    if (result === "correct") {
      play("correct");
      const score = nextHints.length;
      const prev = bestScores[difficulty];
      if (prev == null || score < prev) {
        setBestScores((b) => ({ ...b, [difficulty]: score }));
        setNewBest(true);
      }
      setTimeout(() => play("win"), 100);
      setPhase("won");
    } else if (nextHints.length >= cfg.tries) {
      play("wrong");
      setTimeout(() => play("lose"), 150);
      setPhase("lost");
    } else {
      play("wrong");
    }
  };

  if (phase === "setup") {
    return <SetupScreen bestScores={bestScores} onStart={handleStart} />;
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-slide-up p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPhase("setup")}
          className="text-xs font-bold text-game-muted hover:text-game-accent transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Setup
        </button>
        <span className="text-xs font-bold text-game-muted px-2 py-1 rounded-full bg-game-surface border border-game-border">
          {cfg.label} · 1–{cfg.max}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreDisplay label="Guess" value={tries} />
        <ScoreDisplay label="Left" value={triesLeft} highlight={triesLeft <= 2} />
        <ScoreDisplay label="Best" value={bestScores[difficulty] ?? "—"} />
      </div>

      {/* Temperature meter (after first guess) */}
      {hints.length > 0 && phase === "playing" && (
        <div className="bg-game-surface rounded-2xl border border-game-border p-4">
          <TempMeter temp={lastTemp} />
        </div>
      )}

      <RangeBar hints={hints} max={cfg.max} />

      {/* Won */}
      {phase === "won" && (
        <div className="flex flex-col gap-3">
          <div className={[
            "rounded-2xl border-2 p-4",
            newBest
              ? "border-game-accent bg-game-accent/10"
              : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950",
          ].join(" ")}>
            <div className={`text-base font-black ${newBest ? "text-game-accent" : "text-green-700 dark:text-green-300"}`}>
              {newBest ? "New best!" : "Correct!"}
            </div>
            <div className="text-sm mt-0.5 text-game-muted">
              The number was <strong className="text-game-text">{secret}</strong>.{" "}
              Got it in <strong className="text-game-text">{tries}</strong>{" "}
              {tries === 1 ? "try" : "tries"}.
            </div>
          </div>
          <div className="flex gap-2">
            <GameButton onClick={() => handleStart(difficulty)} size="lg" className="flex-1">
              Play again
            </GameButton>
            <GameButton onClick={() => setPhase("setup")} size="lg" variant="secondary" className="flex-1">
              Change difficulty
            </GameButton>
          </div>
        </div>
      )}

      {/* Lost */}
      {phase === "lost" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
            <div className="text-base font-black text-red-700 dark:text-red-300">Out of tries!</div>
            <div className="text-sm mt-0.5 text-game-muted">
              The number was <strong className="text-game-text">{secret}</strong>.
            </div>
          </div>
          <div className="flex gap-2">
            <GameButton onClick={() => handleStart(difficulty)} size="lg" className="flex-1">
              Try again
            </GameButton>
            <GameButton onClick={() => setPhase("setup")} size="lg" variant="secondary" className="flex-1">
              Change difficulty
            </GameButton>
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="flex flex-col gap-3">
          <GameInput
            ref={inputRef}
            label={`Guess a number (1–${cfg.max})`}
            type="number"
            min={1}
            max={cfg.max}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuess()}
            placeholder="?"
            hint={`${cfg.tries} tries total · ${triesLeft} left`}
          />
          <GameButton onClick={handleGuess} size="lg" className="w-full" disabled={input === ""}>
            Guess
          </GameButton>
        </div>
      )}

      {/* History */}
      {hints.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-game-muted uppercase tracking-widest">History</div>
          <div className="flex flex-col-reverse gap-1.5">
            {hints.map((h, i) => (
              <AnimatedHintItem
                key={i}
                hint={h}
                index={i}
                isNew={i === hints.length - 1}
                tries={tries}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
