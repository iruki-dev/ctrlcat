import { useCallback, useEffect, useMemo, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "solved" | "won" | "lost";

interface Puzzle {
  word: string;
  hint: string;
}

const PUZZLES: Puzzle[] = [
  { word: "HARBOR", hint: "Where boats wait out the weather" },
  { word: "LANTERN", hint: "A light you can carry" },
  { word: "MARBLE", hint: "A small glass sphere, or a kind of stone" },
  { word: "ORCHARD", hint: "A field planted with fruit trees" },
  { word: "WHISPER", hint: "Speech almost too quiet to hear" },
  { word: "COMPASS", hint: "It always points the same way" },
  { word: "BLANKET", hint: "You pull it up when the room is cold" },
  { word: "JOURNEY", hint: "A long trip from one place to another" },
  { word: "SILVER", hint: "A bright metal, second place at the games" },
  { word: "THUNDER", hint: "The sound that follows lightning" },
  { word: "PUZZLE", hint: "Something built to be worked out" },
  { word: "GARDEN", hint: "A patch of ground you tend" },
  { word: "MIRROR", hint: "It shows you back to yourself" },
  { word: "CANDLE", hint: "Wax with a wick" },
  { word: "FOREST", hint: "Trees for as far as you can walk" },
  { word: "RIBBON", hint: "A thin strip tied in a bow" },
  { word: "VELVET", hint: "Fabric with a soft nap" },
  { word: "MONSOON", hint: "A season of heavy rain" },
  { word: "QUARRY", hint: "Where stone is cut from the ground" },
  { word: "SHADOW", hint: "It follows you on a sunny day" },
  { word: "TRUMPET", hint: "A brass instrument with three valves" },
  { word: "WINDOW", hint: "A hole in the wall with glass in it" },
  { word: "ANCHOR", hint: "It holds a ship in place" },
  { word: "BRIDGE", hint: "It carries a road over water" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_MISSES = 6;
const ROUND_COUNT = 8;

function shuffled(list: Puzzle[]): Puzzle[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

export default function Hangman() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<Puzzle[]>([]);
  const [round, setRound] = useState(0);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [lastGain, setLastGain] = useState(0);

  const puzzle = deck[round] ?? null;

  const misses = useMemo(() => {
    if (!puzzle) return 0;
    return guessed.filter((letter) => !puzzle.word.includes(letter)).length;
  }, [guessed, puzzle]);

  const livesLeft = MAX_MISSES - misses;

  const startRun = useCallback(() => {
    setDeck(shuffled(PUZZLES).slice(0, ROUND_COUNT));
    setRound(0);
    setGuessed([]);
    setScore(0);
    setLastGain(0);
    setPhase("playing");
  }, []);

  const finishRun = useCallback(
    (won: boolean, finalScore: number) => {
      setBestScore((best) => (best === null || finalScore > best ? finalScore : best));
      setPhase(won ? "won" : "lost");
    },
    [],
  );

  const guess = useCallback(
    (letter: string) => {
      if (phase !== "playing" || !puzzle || guessed.includes(letter)) return;

      const next = guessed.concat(letter);
      setGuessed(next);

      const wrong = next.filter((item) => !puzzle.word.includes(item)).length;
      const solved = puzzle.word.split("").every((char) => next.includes(char));

      if (solved) {
        const gain = 20 + (MAX_MISSES - wrong) * 5;
        const total = score + gain;
        setLastGain(gain);
        setScore(total);
        if (round + 1 >= deck.length) {
          finishRun(true, total);
        } else {
          setPhase("solved");
        }
        return;
      }

      if (wrong >= MAX_MISSES) {
        finishRun(false, score);
      }
    },
    [deck.length, finishRun, guessed, phase, puzzle, round, score],
  );

  const nextRound = useCallback(() => {
    setRound((current) => current + 1);
    setGuessed([]);
    setPhase("playing");
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        if (phase === "solved") nextRound();
        else if (phase === "idle" || phase === "won" || phase === "lost") startRun();
        return;
      }

      if (phase !== "playing") return;
      if (event.key.length !== 1) return;

      const letter = event.key.toUpperCase();
      if (letter >= "A" && letter <= "Z") {
        event.preventDefault();
        guess(letter);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guess, nextRound, phase, startRun]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <Gallows misses={0} />
        <div className="flex flex-col gap-2">
          <p className="text-game-text-dim">
            Guess the hidden word one letter at a time. Six wrong guesses and the run is over.
          </p>
          <p className="text-game-text-dim text-sm">
            Eight words per run. Every chance you have left at the end of a word is worth extra points.
          </p>
        </div>
        <GameButton onClick={startRun} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    const answer = phase === "lost" && puzzle ? puzzle.word : null;
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <Gallows misses={phase === "lost" ? MAX_MISSES : 0} />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Score" value={score} size="lg" highlight />
          <ScoreDisplay label="Best" value={bestScore ?? score} size="lg" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `You cleared all ${ROUND_COUNT} words.`
            : answer
              ? `Out of chances. The word was ${answer}.`
              : "Out of chances."}
        </GameMessage>
        <GameButton onClick={startRun} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  if (!puzzle) return null;

  const revealed = phase === "solved";
  const wrongLetters = guessed.filter((letter) => !puzzle.word.includes(letter));

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Word" value={`${round + 1} / ${deck.length}`} />
        <ScoreDisplay label="Chances" value={livesLeft} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <Gallows misses={misses} />
        <p className="text-game-text-dim text-sm text-center">{puzzle.hint}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-label="Hidden word">
        {puzzle.word.split("").map((char, index) => {
          const open = guessed.includes(char);
          return (
            <span
              key={`${char}-${index}`}
              className={`w-8 h-10 flex items-end justify-center border-b-2 text-2xl font-semibold transition-colors duration-200 ${
                open ? "border-game-accent text-game-text" : "border-game-border text-game-bg"
              }`}
            >
              {open ? char : ""}
            </span>
          );
        })}
      </div>

      {revealed ? (
        <div className="flex flex-col gap-3 animate-slide-up">
          <GameMessage type="success">
            Solved for {lastGain} points. {deck.length - round - 1} words left.
          </GameMessage>
          <GameButton onClick={nextRound} size="lg">
            Next word
          </GameButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {ALPHABET.map((letter) => {
              const used = guessed.includes(letter);
              const hit = used && puzzle.word.includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => guess(letter)}
                  disabled={used}
                  aria-label={`Guess ${letter}`}
                  className={`h-10 rounded-lg border text-sm font-semibold transition-all duration-150 ${
                    hit
                      ? "border-game-accent bg-game-accent/20 text-game-accent"
                      : used
                        ? "border-game-border bg-game-surface text-game-text-dim opacity-50"
                        : "border-game-border bg-game-surface text-game-text hover:border-game-accent hover:text-game-accent active:scale-95"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <p className="text-game-text-dim text-xs text-center min-h-4">
            {wrongLetters.length > 0 ? `Missed: ${wrongLetters.join(" ")}` : "Type a letter or tap the keyboard."}
          </p>
        </div>
      )}

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        Quit
      </GameButton>
    </div>
  );
}

function Gallows({ misses }: { misses: number }) {
  const part = (index: number) =>
    `transition-opacity duration-300 ${misses >= index ? "opacity-100" : "opacity-0"}`;

  return (
    <svg
      viewBox="0 0 120 140"
      width="150"
      height="175"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      className="text-game-secondary"
      role="img"
      aria-label={`${misses} of ${MAX_MISSES} wrong guesses`}
    >
      <g className="text-game-border" stroke="currentColor">
        <line x1="14" y1="131" x2="62" y2="131" />
        <line x1="26" y1="131" x2="26" y2="20" />
        <line x1="26" y1="20" x2="60" y2="20" />
        <line x1="60" y1="20" x2="60" y2="34" />
      </g>
      <g stroke="currentColor">
        <circle cx="60" cy="45" r="11" className={part(1)} />
        <line x1="60" y1="56" x2="60" y2="92" className={part(2)} />
        <line x1="60" y1="66" x2="44" y2="80" className={part(3)} />
        <line x1="60" y1="66" x2="76" y2="80" className={part(4)} />
        <line x1="60" y1="92" x2="46" y2="117" className={part(5)} />
        <line x1="60" y1="92" x2="74" y2="117" className={part(6)} />
      </g>
    </svg>
  );
}
