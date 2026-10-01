import { useCallback, useEffect, useMemo, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

const WORD_LENGTH = 5;
const MAX_ROWS = 6;

const WORDS: string[] = [
  "about", "above", "actor", "adapt", "admit", "adopt", "after", "again",
  "agent", "agree", "ahead", "alarm", "album", "alert", "alike", "alive",
  "allow", "alone", "along", "alter", "among", "anger", "angle", "angry",
  "apart", "apple", "apply", "arena", "argue", "arise", "armor", "array",
  "arrow", "aside", "asset", "avoid", "awake", "award", "aware", "beach",
  "beard", "beast", "begin", "being", "below", "bench", "berry", "birth",
  "black", "blade", "blame", "blank", "blast", "blend", "blind", "block",
  "blood", "bloom", "board", "boost", "bound", "brain", "brand", "brave",
  "bread", "break", "brick", "bride", "brief", "bring", "broad", "brown",
  "brush", "build", "burst", "cabin", "cable", "candy", "canoe", "cargo",
  "carry", "carve", "catch", "cause", "chain", "chair", "chalk", "charm",
  "chart", "chase", "cheap", "check", "cheer", "chess", "chest", "chief",
  "child", "chill", "choir", "chunk", "civil", "claim", "class", "clean",
  "clear", "clerk", "cliff", "climb", "clock", "close", "cloth", "cloud",
  "coach", "coast", "cobra", "color", "coral", "couch", "count", "court",
  "cover", "crack", "craft", "crane", "crash", "crawl", "cream", "creek",
  "crest", "crime", "crisp", "cross", "crowd", "crown", "crush", "curve",
  "cycle", "daily", "dairy", "dance", "death", "debut", "delay", "dense",
  "depth", "diary", "ditch", "dodge", "donor", "doubt", "dozen", "draft",
  "drain", "drama", "dream", "dress", "drift", "drink", "drive", "eager",
  "early", "earth", "eight", "elbow", "elder", "elect", "elite", "empty",
  "enemy", "enjoy", "enter", "entry", "equal", "error", "essay", "event",
  "exact", "exist", "extra", "fable", "faith", "false", "fancy", "fault",
  "favor", "feast", "fence", "ferry", "fever", "field", "fiber", "fifty",
  "fight", "final", "first", "flame", "flash", "fleet", "float", "flock",
  "flood", "floor", "flour", "fluid", "focus", "force", "forge", "forty",
  "forum", "found", "frame", "fresh", "front", "frost", "fruit", "funny",
  "genre", "ghost", "giant", "glass", "globe", "glory", "glove", "grace",
  "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass",
  "grave", "great", "green", "greet", "grief", "grill", "grind", "group",
  "grove", "guard", "guess", "guest", "guide", "guilt", "habit", "handy",
  "happy", "harsh", "haste", "hatch", "haunt", "heart", "heavy", "hedge",
  "hobby", "honey", "honor", "horse", "hotel", "house", "human", "humor",
  "hurry", "ideal", "image", "index", "inner", "input", "irony", "issue",
  "ivory", "jeans", "jelly", "jewel", "joint", "judge", "juice", "knife",
  "knock", "known", "label", "labor", "large", "laser", "later", "laugh",
  "layer", "learn", "lease", "least", "leave", "legal", "lemon", "level",
  "lever", "light", "limit", "linen", "lobby", "local", "lodge", "logic",
  "loose", "lower", "loyal", "lucky", "lunar", "lunch", "magic", "major",
  "maker", "mango", "march", "match", "mayor", "medal", "media", "mercy",
  "merge", "merit", "metal", "meter", "might", "minor", "model", "moist",
  "money", "month", "moral", "motor", "mount", "mouse", "mouth", "movie",
  "music", "naval", "nerve", "night", "noble", "noise", "north", "notch",
  "novel", "nurse", "occur", "ocean", "offer", "often", "olive", "onion",
  "onset", "opera", "orbit", "order", "organ", "other", "ounce", "outer",
  "owner", "paint", "panel", "panic", "paper", "party", "pasta", "patch",
  "pause", "peace", "peach", "pearl", "pedal", "penny", "phase", "phone",
  "photo", "piano", "piece", "pilot", "pinch", "pitch", "pivot", "pixel",
  "place", "plain", "plane", "plant", "plate", "plaza", "point", "polar",
  "porch", "pound", "power", "press", "price", "pride", "prime", "print",
  "prize", "proof", "proud", "prove", "pulse", "punch", "pupil", "purse",
  "quest", "queue", "quick", "quiet", "quilt", "quite", "quote", "radar",
  "radio", "raise", "rally", "ranch", "range", "rapid", "ratio", "reach",
  "react", "ready", "realm", "rebel", "refer", "relax", "relay", "renew",
  "reply", "rider", "ridge", "rifle", "right", "rigid", "rinse", "risky",
  "rival", "river", "roast", "robot", "rocky", "roman", "rough", "round",
  "route", "royal", "rugby", "ruler", "rural", "salad", "sauce", "scale",
  "scare", "scene", "scope", "score", "scout", "scrap", "sense", "serve",
  "shade", "shaft", "shake", "shape", "share", "shark", "sharp", "sheep",
  "sheet", "shelf", "shell", "shift", "shine", "shirt", "shock", "shore",
  "short", "shout", "sight", "silly", "since", "siren", "skill", "skirt",
  "slate", "sleep", "slice", "slide", "slope", "small", "smart", "smile",
  "smoke", "snack", "snake", "solid", "solve", "sound", "south", "space",
  "spare", "spark", "speak", "speed", "spend", "spice", "spike", "spine",
  "spoil", "split", "spoke", "sport", "spray", "squad",
  "stack", "staff", "stage", "stair", "stake", "stamp", "stand", "stare",
  "start", "state", "steam", "steel", "steep", "steer", "stern", "stick",
  "still", "sting", "stock", "stone", "stood", "store", "storm", "story",
  "stove", "strap", "straw", "study", "stuff", "style", "sugar", "suite",
  "sunny", "super", "surge", "swarm", "sweep", "sweet", "swift", "swing",
  "sword", "table", "taken", "tally", "tango", "taste", "teach", "tempo",
  "tenth", "thank", "theme", "there", "thick", "thigh", "thing", "think",
  "third", "those", "three", "threw", "throw", "thumb", "tiger", "tight",
  "timer", "title", "toast", "today", "token", "tooth", "topic", "torch",
  "total", "touch", "tough", "tower", "trace", "track", "trade", "trail",
  "train", "trait", "trash", "treat", "trend", "trial", "tribe", "trick",
  "troop", "trout", "truck", "truly", "trunk", "trust", "truth", "tulip",
  "tutor", "twice", "twist", "uncle", "under", "union", "unite", "unity",
  "until", "upper", "upset", "urban", "usage", "usual", "vague", "valid",
  "value", "valve", "vapor", "vault", "venue", "verse", "video", "villa",
  "vinyl", "virus", "visit", "vital", "vivid", "vocal", "voice", "voter",
  "wagon", "waist", "waste", "watch", "water", "wheat", "wheel", "where",
  "which", "while", "white", "whole", "widow", "width", "wince", "wired",
  "witch", "woman", "world", "worry", "worth", "would", "wound", "woven",
  "wrist", "write", "wrong", "yacht", "yield", "young", "youth", "zebra",
];

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

type Phase = "idle" | "playing" | "won" | "lost";
type Mark = "correct" | "present" | "absent";

interface Row {
  word: string;
  marks: Mark[];
}

const MARK_RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

function judge(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(WORD_LENGTH).fill("absent");
  const pool = new Map<string, number>();

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      marks[i] = "correct";
    } else {
      pool.set(answer[i], (pool.get(answer[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (marks[i] === "correct") continue;
    const left = pool.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = "present";
      pool.set(guess[i], left - 1);
    }
  }

  return marks;
}

function pickWord(exclude: string[]): string {
  const pool = WORDS.filter((word) => !exclude.includes(word));
  const source = pool.length > 0 ? pool : WORDS;
  return source[Math.floor(Math.random() * source.length)];
}

const markTile: Record<Mark, string> = {
  correct: "bg-game-accent border-game-accent text-white",
  present: "bg-game-secondary border-game-secondary text-white",
  absent: "bg-game-muted/25 border-game-border text-game-text-dim",
};

const markKey: Record<Mark, string> = {
  correct: "bg-game-accent border-game-accent text-white",
  present: "bg-game-secondary border-game-secondary text-white",
  absent: "bg-game-muted/20 border-game-border text-game-muted",
};

export default function WordGuess() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [solved, setSolved] = useState(0);
  const [gained, setGained] = useState(0);
  const [used, setUsed] = useState<string[]>([]);

  const deal = useCallback((exclude: string[]) => {
    const next = pickWord(exclude);
    setUsed([...exclude, next]);
    setAnswer(next);
    setRows([]);
    setCurrent("");
    setNotice(null);
    setPhase("playing");
  }, []);

  const startRun = useCallback(() => {
    setScore(0);
    setSolved(0);
    setGained(0);
    deal([]);
  }, [deal]);

  const nextWord = useCallback(() => {
    deal(used);
  }, [deal, used]);

  const submit = useCallback(() => {
    if (current.length < WORD_LENGTH) {
      setNotice("Fill all five letters first.");
      return;
    }

    const guess = current.toLowerCase();
    if (!WORDS.includes(guess)) {
      setNotice("That word is not in the list.");
      return;
    }

    const nextRows = [...rows, { word: guess, marks: judge(guess, answer) }];
    setRows(nextRows);
    setCurrent("");
    setNotice(null);

    if (guess === answer) {
      const reward = (MAX_ROWS - nextRows.length + 1) * 100;
      const total = score + reward;
      setGained(reward);
      setScore(total);
      setSolved((count) => count + 1);
      setBestScore((best) => (best === null || total > best ? total : best));
      setPhase("won");
    } else if (nextRows.length >= MAX_ROWS) {
      setPhase("lost");
    }
  }, [answer, current, rows, score]);

  const press = useCallback(
    (key: string) => {
      if (phase !== "playing") return;
      if (key === "Enter") {
        submit();
        return;
      }
      if (key === "Backspace") {
        setCurrent((value) => value.slice(0, -1));
        return;
      }
      if (/^[a-z]$/i.test(key)) {
        setCurrent((value) =>
          value.length < WORD_LENGTH ? value + key.toUpperCase() : value,
        );
      }
    },
    [phase, submit],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter" || event.key === "Backspace") {
        event.preventDefault();
        press(event.key);
        return;
      }
      if (/^[a-z]$/i.test(event.key)) press(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, press]);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const keyState = useMemo(() => {
    const map: Record<string, Mark> = {};
    for (const row of rows) {
      for (let i = 0; i < WORD_LENGTH; i += 1) {
        const letter = row.word[i].toUpperCase();
        const mark = row.marks[i];
        const seen = map[letter];
        if (seen === undefined || MARK_RANK[mark] > MARK_RANK[seen]) {
          map[letter] = mark;
        }
      }
    }
    return map;
  }, [rows]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          Guess the hidden five-letter word in six tries. After each guess, a
          purple tile means the letter is in the right spot and a pink tile
          means it belongs somewhere else. Solve a word to keep your run going.
        </p>
        {bestScore !== null && (
          <ScoreDisplay label="Best" value={bestScore} size="lg" />
        )}
        <GameButton onClick={startRun} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    const won = phase === "won";
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Score" value={score} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Words solved" value={solved} />
          <ScoreDisplay label="Best" value={bestScore ?? "—"} />
        </div>
        <GameMessage type={won ? "success" : "error"}>
          {won
            ? `Correct in ${rows.length} ${rows.length === 1 ? "try" : "tries"}. Plus ${gained} points.`
            : `Out of tries. The word was ${answer.toUpperCase()}.`}
        </GameMessage>
        {won ? (
          <div className="flex flex-col items-center gap-3">
            <GameButton onClick={nextWord} size="xl">
              Next word
            </GameButton>
            <GameButton
              variant="ghost"
              size="sm"
              onClick={() => setPhase("idle")}
            >
              End run
            </GameButton>
          </div>
        ) : (
          <GameButton onClick={startRun} size="xl">
            Play again
          </GameButton>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Tries left" value={MAX_ROWS - rows.length} />
        <ScoreDisplay label="Solved" value={solved} />
      </div>

      <div className="flex flex-col gap-2 items-center">
        {Array.from({ length: MAX_ROWS }, (_, rowIndex) => {
          const submitted = rows[rowIndex];
          const active = rowIndex === rows.length;
          return (
            <div key={rowIndex} className="grid grid-cols-5 gap-2">
              {Array.from({ length: WORD_LENGTH }, (_, cellIndex) => {
                const letter = submitted
                  ? submitted.word[cellIndex].toUpperCase()
                  : active
                    ? (current[cellIndex] ?? "")
                    : "";
                const tone = submitted
                  ? markTile[submitted.marks[cellIndex]]
                  : letter
                    ? "bg-game-surface border-game-accent text-game-text"
                    : "bg-game-surface border-game-border text-game-text";
                return (
                  <div
                    key={cellIndex}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black uppercase transition-all duration-200 ${tone}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {notice !== null && <GameMessage type="warning">{notice}</GameMessage>}

      <div className="flex flex-col gap-2 items-center">
        {KEY_ROWS.map((keyRow, index) => (
          <div key={keyRow} className="flex gap-1.5 justify-center">
            {index === 2 && (
              <button
                type="button"
                onClick={() => press("Enter")}
                className="px-3 h-11 rounded-lg border-2 border-game-accent bg-game-accent-light text-xs font-bold uppercase tracking-wide text-game-accent transition-all duration-150 hover:bg-game-accent/20"
              >
                Enter
              </button>
            )}
            {keyRow.split("").map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => press(letter)}
                className={`w-8 h-11 rounded-lg border-2 text-sm font-bold transition-all duration-150 hover:brightness-95 ${
                  keyState[letter]
                    ? markKey[keyState[letter]]
                    : "bg-game-surface border-game-border text-game-text"
                }`}
              >
                {letter}
              </button>
            ))}
            {index === 2 && (
              <button
                type="button"
                onClick={() => press("Backspace")}
                className="px-3 h-11 rounded-lg border-2 border-game-border bg-game-surface text-xs font-bold uppercase tracking-wide text-game-text-dim transition-all duration-150 hover:bg-game-muted/15"
              >
                Del
              </button>
            )}
          </div>
        ))}
      </div>

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        Quit
      </GameButton>
    </div>
  );
}
