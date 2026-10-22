import { useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "reveal" | "won" | "lost";

interface Question {
  q: string;
  a: [string, string, string, string];
  c: number;
  cat: string;
}

const ROUND_LENGTH = 10;
const QUESTION_SECONDS = 15;
const WIN_THRESHOLD = 7;
const BASE_POINTS = 100;
const STREAK_BONUS = 25;
const TIME_BONUS = 5;

const POOL: Question[] = [
  { q: "What is the capital of Australia?", a: ["Sydney", "Melbourne", "Canberra", "Perth"], c: 2, cat: "Geography" },
  { q: "Which planet is the largest in the solar system?", a: ["Saturn", "Jupiter", "Neptune", "Uranus"], c: 1, cat: "Science" },
  { q: "What is the chemical symbol for gold?", a: ["Go", "Gd", "Au", "Ag"], c: 2, cat: "Science" },
  { q: "Who painted the Mona Lisa?", a: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Donatello"], c: 0, cat: "Art" },
  { q: "Which is the largest ocean on Earth?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3, cat: "Geography" },
  { q: "How many players from one team are on a soccer field at kickoff?", a: ["9", "10", "11", "12"], c: 2, cat: "Sport" },
  { q: "Which gas do plants absorb from the air?", a: ["Oxygen", "Carbon dioxide", "Hydrogen", "Helium"], c: 1, cat: "Science" },
  { q: "Which river runs through Paris?", a: ["Rhine", "Loire", "Seine", "Danube"], c: 2, cat: "Geography" },
  { q: "What is the hardest natural substance?", a: ["Quartz", "Steel", "Diamond", "Granite"], c: 2, cat: "Science" },
  { q: "Which country gave the Statue of Liberty to the United States?", a: ["France", "Spain", "Italy", "Portugal"], c: 0, cat: "History" },
  { q: "How many strings does a standard guitar have?", a: ["4", "5", "6", "7"], c: 2, cat: "Music" },
  { q: "Which element has the symbol O?", a: ["Osmium", "Oxygen", "Gold", "Oganesson"], c: 1, cat: "Science" },
  { q: "What is the largest mammal alive today?", a: ["African elephant", "Blue whale", "Giraffe", "Orca"], c: 1, cat: "Nature" },
  { q: "In which country are the pyramids of Giza?", a: ["Sudan", "Mexico", "Egypt", "Peru"], c: 2, cat: "History" },
  { q: "How many degrees are in a right angle?", a: ["45", "60", "90", "180"], c: 2, cat: "Numbers" },
  { q: "Who wrote the play Romeo and Juliet?", a: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Oscar Wilde"], c: 1, cat: "Books" },
  { q: "Which planet is known as the Red Planet?", a: ["Venus", "Mercury", "Mars", "Pluto"], c: 2, cat: "Science" },
  { q: "What is the currency of Japan?", a: ["Won", "Yuan", "Yen", "Baht"], c: 2, cat: "Geography" },
  { q: "How many sides does a hexagon have?", a: ["5", "6", "7", "8"], c: 1, cat: "Numbers" },
  { q: "What is the smallest prime number?", a: ["0", "1", "2", "3"], c: 2, cat: "Numbers" },
  { q: "At what temperature in Celsius does water freeze?", a: ["0", "10", "32", "100"], c: 0, cat: "Science" },
  { q: "Which metal is liquid at room temperature?", a: ["Lead", "Mercury", "Tin", "Zinc"], c: 1, cat: "Science" },
  { q: "On which continent is the Sahara desert?", a: ["Asia", "Australia", "Africa", "South America"], c: 2, cat: "Geography" },
  { q: "Which organ pumps blood around your body?", a: ["Lungs", "Liver", "Kidney", "Heart"], c: 3, cat: "Body" },
  { q: "How many bones are in the adult human body?", a: ["186", "206", "226", "246"], c: 1, cat: "Body" },
  { q: "Which country has the largest land area?", a: ["Canada", "China", "Russia", "United States"], c: 2, cat: "Geography" },
  { q: "Who developed the theory of general relativity?", a: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Galileo Galilei"], c: 1, cat: "Science" },
  { q: "Which vitamin does sunlight help your body produce?", a: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"], c: 3, cat: "Body" },
  { q: "What is the capital of Canada?", a: ["Toronto", "Ottawa", "Vancouver", "Montreal"], c: 1, cat: "Geography" },
  { q: "How many colours are traditionally listed in a rainbow?", a: ["5", "6", "7", "9"], c: 2, cat: "Numbers" },
  { q: "Which is the fastest land animal?", a: ["Cheetah", "Pronghorn", "Lion", "Greyhound"], c: 0, cat: "Nature" },
  { q: "Which ocean lies to the east of the United States?", a: ["Pacific", "Atlantic", "Indian", "Southern"], c: 1, cat: "Geography" },
  { q: "Which instrument has 88 keys?", a: ["Organ", "Harpsichord", "Piano", "Accordion"], c: 2, cat: "Music" },
  { q: "Which country hosted the 2016 Summer Olympics?", a: ["China", "Brazil", "Japan", "Greece"], c: 1, cat: "Sport" },
  { q: "How many minutes are in a full day?", a: ["720", "1200", "1440", "2400"], c: 2, cat: "Numbers" },
  { q: "What is the largest internal organ in the human body?", a: ["Liver", "Brain", "Stomach", "Lung"], c: 0, cat: "Body" },
  { q: "Which gas makes up most of Earth's atmosphere?", a: ["Oxygen", "Nitrogen", "Argon", "Carbon dioxide"], c: 1, cat: "Science" },
  { q: "Who was the first person to walk on the moon?", a: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], c: 2, cat: "History" },
  { q: "How many zeroes are in one million?", a: ["5", "6", "7", "9"], c: 1, cat: "Numbers" },
  { q: "Which bird is a common symbol of peace?", a: ["Eagle", "Dove", "Swan", "Crane"], c: 1, cat: "Nature" },
  { q: "What is the main ingredient in guacamole?", a: ["Cucumber", "Pea", "Avocado", "Courgette"], c: 2, cat: "Food" },
  { q: "Which planet orbits closest to the sun?", a: ["Mercury", "Venus", "Earth", "Mars"], c: 0, cat: "Science" },
  { q: "The Great Barrier Reef lies off the coast of which country?", a: ["Indonesia", "Australia", "Philippines", "Fiji"], c: 1, cat: "Geography" },
  { q: "How many letters are in the English alphabet?", a: ["24", "25", "26", "28"], c: 2, cat: "Numbers" },
  { q: "Which sport is played with a shuttlecock?", a: ["Squash", "Badminton", "Tennis", "Pickleball"], c: 1, cat: "Sport" },
  { q: "Which metal is the best conductor of electricity?", a: ["Copper", "Gold", "Aluminium", "Silver"], c: 3, cat: "Science" },
  { q: "Mount Everest sits in which mountain range?", a: ["Andes", "Alps", "Himalayas", "Rockies"], c: 2, cat: "Geography" },
  { q: "How many faces does a cube have?", a: ["4", "6", "8", "12"], c: 1, cat: "Numbers" },
  { q: "Which language has the most native speakers?", a: ["English", "Spanish", "Hindi", "Mandarin Chinese"], c: 3, cat: "Language" },
  { q: "What is the tallest animal in the world?", a: ["Elephant", "Giraffe", "Camel", "Moose"], c: 1, cat: "Nature" },
  { q: "Which sea is the saltiest large body of water?", a: ["Red Sea", "Dead Sea", "Black Sea", "Baltic Sea"], c: 1, cat: "Geography" },
  { q: "Who wrote the novel Pride and Prejudice?", a: ["Jane Austen", "Emily Bronte", "Mary Shelley", "George Eliot"], c: 0, cat: "Books" },
];

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function TriviaQuiz() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [gained, setGained] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);

  const question = round[index];
  const inPlay = phase === "playing" || phase === "reveal";

  function startGame() {
    setRound(shuffle(POOL).slice(0, ROUND_LENGTH));
    setIndex(0);
    setSelected(null);
    setGained(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrect(0);
    setTimeLeft(QUESTION_SECONDS);
    setPhase("playing");
  }

  function submitAnswer(choice: number) {
    if (phase !== "playing" || !question) return;
    setSelected(choice);
    if (choice === question.c) {
      const nextStreak = streak + 1;
      const points =
        BASE_POINTS + (nextStreak - 1) * STREAK_BONUS + Math.ceil(timeLeft) * TIME_BONUS;
      setScore((s) => s + points);
      setGained(points);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setCorrect((c) => c + 1);
    } else {
      setStreak(0);
      setGained(0);
    }
    setPhase("reveal");
  }

  function advance() {
    if (phase !== "reveal") return;
    if (index + 1 >= round.length) {
      setBestScore((b) => (b === null || score > b ? score : b));
      setPhase(correct >= WIN_THRESHOLD ? "won" : "lost");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setGained(0);
    setTimeLeft(QUESTION_SECONDS);
    setPhase("playing");
  }

  /* Per-question countdown. Running out counts as a wrong answer. */
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => Math.max(0, Math.round((t - 0.1) * 10) / 10));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, index]);

  useEffect(() => {
    if (phase === "playing" && timeLeft <= 0) submitAnswer(-1);
  });

  /* Keys 1-4 answer, Enter or Space moves on. The ref keeps the
     listener stable while it always sees current state. */
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (event: KeyboardEvent) => {
    if (phase === "idle" || phase === "won" || phase === "lost") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startGame();
      }
      return;
    }
    if (phase === "playing" && /^[1-4]$/.test(event.key)) {
      submitAnswer(Number(event.key) - 1);
      return;
    }
    if (phase === "reveal" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      advance();
    }
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">
            Ten general knowledge questions, four choices each. You have{" "}
            {QUESTION_SECONDS} seconds per question.
          </p>
          <p className="text-game-text-dim">
            Answer faster and keep a streak going for more points. Get{" "}
            {WIN_THRESHOLD} or more right to clear the round.
          </p>
        </div>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
        <p className="text-xs text-game-muted">Tap an answer, or press 1 to 4</p>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Score" value={score} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Correct" value={`${correct} / ${round.length}`} size="sm" />
          <ScoreDisplay label="Best streak" value={bestStreak} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `Round cleared with ${correct} of ${round.length} correct.`
            : `Only ${correct} of ${round.length} correct. You need ${WIN_THRESHOLD} to clear the round.`}
        </GameMessage>
        {bestScore !== null && (
          <p className="text-sm text-game-text-dim">Best score so far: {bestScore}</p>
        )}
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  if (!question) return null;

  const timeRatio = Math.max(0, Math.min(1, timeLeft / QUESTION_SECONDS));
  const lowTime = timeLeft <= 5;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Score" value={score} size="sm" highlight />
        <ScoreDisplay label="Streak" value={streak} size="sm" />
        <ScoreDisplay label="Best" value={bestScore ?? "—"} size="sm" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-game-muted">
          <span>
            Question {index + 1} of {round.length}
          </span>
          <span className={lowTime ? "text-game-secondary" : "text-game-muted"}>
            {Math.ceil(timeLeft)}s
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-game-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
              lowTime ? "bg-game-secondary" : "bg-game-accent"
            }`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 border-game-border bg-game-surface p-5 flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-game-accent">
          {question.cat}
        </span>
        <p className="text-lg font-semibold text-game-text">{question.q}</p>
      </div>

      <div className="flex flex-col gap-3">
        {question.a.map((option, i) => {
          const isAnswer = i === question.c;
          const isPicked = i === selected;
          let tone =
            "border-game-border bg-game-surface text-game-text hover:border-game-accent hover:bg-game-accent/[.06]";
          if (phase === "reveal") {
            if (isAnswer) {
              tone =
                "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300";
            } else if (isPicked) {
              tone = "border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300";
            } else {
              tone = "border-game-border bg-game-surface text-game-muted opacity-60";
            }
          }
          return (
            <button
              key={option}
              type="button"
              onClick={() => submitAnswer(i)}
              disabled={phase === "reveal"}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 flex items-center gap-3 font-medium transition-all duration-200 disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2 ${tone}`}
            >
              <span className="shrink-0 w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-black tabular-nums">
                {i + 1}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {phase === "reveal" && (
        <div className="flex flex-col gap-4 animate-slide-up">
          <GameMessage type={selected === question.c ? "success" : "error"}>
            {selected === question.c
              ? `Correct. Plus ${gained} points${streak > 1 ? `, streak of ${streak}` : ""}.`
              : selected === -1
                ? `Time is up. The answer was ${question.a[question.c]}.`
                : `Not quite. The answer was ${question.a[question.c]}.`}
          </GameMessage>
          <GameButton onClick={advance} size="lg">
            {index + 1 >= round.length ? "See results" : "Next question"}
          </GameButton>
        </div>
      )}

      {inPlay && (
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          Quit
        </GameButton>
      )}
    </div>
  );
}
