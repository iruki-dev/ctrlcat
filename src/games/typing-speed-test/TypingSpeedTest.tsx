import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won" | "lost";

const ROUND_SECONDS = 60;
const BEST_KEY = "ctrlcat:typing-speed-test:best";

const PASSAGES = [
  "The train arrived late, so we walked the last part of the way home. The streets were quiet and the shops had already pulled down their shutters. A cat watched us from a low wall, then lost interest and went back to sleep. By the time we reached the corner the rain had stopped and the air smelled clean. We agreed that the walk had been better than the ride.",
  "A good map tells you what to ignore. It leaves out the colour of the houses and the names of the dogs, and keeps only the roads, the rivers, and the hills. That is why a map is useful when you are lost and a photograph is not. The art is in deciding what to throw away, and in being honest about what was left behind.",
  "She kept a notebook in her coat pocket and wrote down one sentence every day. Some days the sentence was about the weather, and some days it was about a person she had passed on the stairs. After three years the notebook was full. Reading it from the start felt like watching a slow film about someone she almost remembered being.",
  "The bread recipe had four ingredients and one instruction worth following: wait. Flour, water, salt, and a little yeast will do the work on their own if you give them time. Rushing the dough makes a loaf that looks right and tastes of nothing. Baking taught him more about patience than any book he had ever finished.",
  "Every harbour has a boat that never leaves. The paint is fresh, the ropes are coiled, and the owner comes down each Sunday to check on things. Neighbours make jokes about it, but they also keep an eye on the weather for him. Perhaps the point was never to sail. Perhaps the point was to have somewhere to go on a Sunday morning.",
];

function pickPassage(previous: string | null) {
  const pool = PASSAGES.filter((p) => p !== previous);
  const list = pool.length > 0 ? pool : PASSAGES;
  return list[Math.floor(Math.random() * list.length)];
}

function readBest(): number | null {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // storage unavailable, personal best stays in memory only
  }
}

export default function TypingSpeedTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [passage, setPassage] = useState("");
  const [typed, setTyped] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestWpm, setBestWpm] = useState<number | null>(null);
  const [newRecord, setNewRecord] = useState(false);

  const startedAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef({ wpm: 0, accuracy: 100, typedWords: 0 });
  const bestRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = readBest();
    bestRef.current = stored;
    setBestWpm(stored);
  }, []);

  const correctChars = useMemo(() => {
    let count = 0;
    for (let i = 0; i < typed.length; i += 1) {
      if (typed[i] === passage[i]) count += 1;
    }
    return count;
  }, [typed, passage]);

  const accuracy = keystrokes === 0 ? 100 : Math.max(0, Math.round(((keystrokes - mistakes) / keystrokes) * 100));
  const minutes = elapsed > 0 ? elapsed / 60 : 0;
  const liveWpm = minutes > 0 ? Math.max(0, Math.round(correctChars / 5 / minutes)) : 0;
  const remaining = Math.max(0, ROUND_SECONDS - Math.floor(elapsed));
  const progress = passage.length === 0 ? 0 : Math.min(100, Math.round((typed.length / passage.length) * 100));

  const finish = useCallback(
    (won: boolean, finalTyped: string, finalElapsed: number, finalKeystrokes: number, finalMistakes: number) => {
      const span = Math.max(finalElapsed, 0.5);
      let correct = 0;
      for (let i = 0; i < finalTyped.length; i += 1) {
        if (finalTyped[i] === passage[i]) correct += 1;
      }
      const wpm = Math.max(0, Math.round(correct / 5 / (span / 60)));
      const acc =
        finalKeystrokes === 0
          ? 100
          : Math.max(0, Math.round(((finalKeystrokes - finalMistakes) / finalKeystrokes) * 100));
      resultRef.current = { wpm, accuracy: acc, typedWords: Math.round(correct / 5) };
      startedAt.current = null;
      setElapsed(finalElapsed);
      setPhase(won ? "won" : "lost");

      const previousBest = bestRef.current;
      const qualifies = acc >= 80 && wpm > 0 && (previousBest === null || wpm > previousBest);
      if (qualifies) {
        bestRef.current = wpm;
        writeBest(wpm);
        setBestWpm(wpm);
      }
      setNewRecord(qualifies);
    },
    [passage],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      if (startedAt.current === null) return;
      const seconds = (Date.now() - startedAt.current) / 1000;
      if (seconds >= ROUND_SECONDS) {
        finish(false, typed, ROUND_SECONDS, keystrokes, mistakes);
      } else {
        setElapsed(seconds);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, typed, keystrokes, mistakes, finish]);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase, passage]);

  const startGame = useCallback(() => {
    setPassage((previous) => pickPassage(previous || null));
    setTyped("");
    setKeystrokes(0);
    setMistakes(0);
    setElapsed(0);
    setNewRecord(false);
    resultRef.current = { wpm: 0, accuracy: 100, typedWords: 0 };
    startedAt.current = null;
    setPhase("playing");
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (phase !== "playing") return;
      const next = event.target.value.slice(0, passage.length);
      if (startedAt.current === null && next.length > 0) startedAt.current = Date.now();

      if (next.length > typed.length) {
        const added = next.length - typed.length;
        let wrong = 0;
        for (let i = typed.length; i < next.length; i += 1) {
          if (next[i] !== passage[i]) wrong += 1;
        }
        setKeystrokes((k) => k + added);
        setMistakes((m) => m + wrong);
      }

      setTyped(next);

      if (next.length === passage.length) {
        const span = startedAt.current === null ? 0.5 : (Date.now() - startedAt.current) / 1000;
        let wrong = 0;
        for (let i = typed.length; i < next.length; i += 1) {
          if (next[i] !== passage[i]) wrong += 1;
        }
        finish(true, next, Math.min(span, ROUND_SECONDS), keystrokes + (next.length - typed.length), mistakes + wrong);
      }
    },
    [phase, passage, typed, keystrokes, mistakes, finish],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" || event.key === "Tab") event.preventDefault();
  }, []);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Copy the passage exactly as it appears. You have sixty seconds. The clock starts on your first keystroke.
          </p>
          <p className="text-game-text-dim">
            Finish the whole passage in time to clear the round. Your speed is measured in words per minute, where one
            word counts as five correct characters.
          </p>
        </div>
        {bestWpm !== null && <ScoreDisplay label="Personal best WPM" value={bestWpm} size="sm" />}
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    const { wpm, accuracy: finalAccuracy, typedWords } = resultRef.current;
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Words per minute" value={wpm} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Accuracy" value={`${finalAccuracy}%`} />
          <ScoreDisplay label="Best WPM" value={bestWpm ?? "—"} />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `Passage finished in ${elapsed.toFixed(1)} seconds.`
            : `Time is up. You typed about ${typedWords} words.`}
        </GameMessage>
        {newRecord && <GameMessage type="hint">New personal best.</GameMessage>}
        {finalAccuracy < 80 && (
          <GameMessage type="warning">Accuracy under eighty percent does not count towards your best.</GameMessage>
        )}
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Seconds left" value={remaining} highlight={remaining <= 10} />
        <ScoreDisplay label="WPM" value={liveWpm} />
        <ScoreDisplay label="Accuracy" value={`${accuracy}%`} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.focus();
        }}
        className="rounded-2xl border-2 border-game-border bg-game-surface p-5 text-left text-lg leading-relaxed tracking-wide cursor-text select-none"
      >
        {passage.split("").map((char, index) => {
          const state =
            index >= typed.length ? "pending" : typed[index] === char ? "correct" : "wrong";
          const isCursor = index === typed.length;
          const display = char === " " && state === "wrong" ? "·" : char;
          return (
            <span
              key={index}
              className={[
                "transition-colors duration-75 rounded-sm",
                state === "correct" ? "text-game-text" : "",
                state === "wrong" ? "text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-950" : "",
                state === "pending" ? "text-game-text-dim" : "",
                isCursor ? "border-b-2 border-game-accent" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {display}
            </span>
          );
        })}
      </div>

      <div className="h-2 w-full rounded-full bg-game-surface border border-game-border overflow-hidden">
        <div
          className="h-full rounded-full bg-game-accent transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <textarea
        ref={inputRef}
        value={typed}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the passage here"
        placeholder="Start typing here"
        className="w-full h-24 resize-none rounded-2xl border-2 border-game-border bg-game-bg p-4 text-base text-game-text placeholder:text-game-text-dim outline-none focus:border-game-accent transition-colors"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-game-text-dim">{progress}% of the passage typed</p>
        <div className="flex gap-2">
          <GameButton variant="ghost" size="sm" onClick={startGame}>
            New passage
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Quit
          </GameButton>
        </div>
      </div>
    </div>
  );
}
