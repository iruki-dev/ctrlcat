import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { GameButton } from "../../components/games/ui/Button";
import { GameInput } from "../../components/games/ui/Input";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won" | "lost";
type Op = "+" | "-" | "x" | "/";

interface Problem {
  a: number;
  b: number;
  op: Op;
  answer: number;
}

interface Feedback {
  id: number;
  kind: "correct" | "wrong";
  /** Points gained when correct, the right answer when wrong. */
  value: number;
}

const GOAL = 25;
const START_MS = 60000;
const BONUS_MS = 1200;
const PENALTY_MS = 4000;
const TICK_MS = 100;
const MAX_LEVEL = 5;

const OP_LABEL: Record<Op, string> = { "+": "+", "-": "−", x: "×", "/": "÷" };

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function levelFor(streak: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(streak / 4));
}

function opsForLevel(level: number): Op[] {
  if (level <= 1) return ["+", "-"];
  if (level === 2) return ["+", "-", "x"];
  return ["+", "-", "x", "/"];
}

function makeProblem(level: number): Problem {
  const ops = opsForLevel(level);
  const op = ops[randInt(0, ops.length - 1)];

  if (op === "+") {
    const span = 8 + level * 12;
    const a = randInt(2, span);
    const b = randInt(2, span);
    return { a, b, op, answer: a + b };
  }

  if (op === "-") {
    const span = 8 + level * 12;
    const a = randInt(5, span);
    const b = randInt(1, a - 1);
    return { a, b, op, answer: a - b };
  }

  if (op === "x") {
    const hi = 4 + level * 2;
    const a = randInt(2, hi);
    const b = randInt(2, hi);
    return { a, b, op, answer: a * b };
  }

  const hi = 3 + level * 2;
  const b = randInt(2, hi);
  const answer = randInt(2, hi);
  return { a: b * answer, b, op: "/", answer };
}

const messages = {
  en: {
    ...common.en,
    intro: (goal: number) =>
      `Solve ${goal} arithmetic problems before the clock runs out. Every correct answer adds a little time and raises your streak. A wrong answer costs four seconds and drops you back to easy problems.`,
    solved: "Solved",
    bestStreak: "Best streak",
    won: (s: string) => `Blitz cleared with ${s} seconds to spare.`,
    lost: "Time is up.",
    streak: "Streak",
    solvedOf: (n: number, goal: number) => `Solved ${n} / ${goal}`,
    levelN: (n: number) => `Level ${n}`,
    seconds: (s: string) => `${s}s`,
    answer: "Your answer",
    answerHint: "Type your answer and press Enter",
    back: "Back",
    enter: "Enter",
    correct: (points: number) => `Correct, +${points} points`,
    wrong: (answer: number) => `Wrong, the answer was ${answer}`,
  },
  ko: {
    ...common.ko,
    intro: (goal: number) =>
      `시간이 다 되기 전에 사칙연산 ${goal}문제를 풀어 보세요. 맞힐 때마다 시간이 조금 늘고 연속 정답이 쌓입니다. 틀리면 4초가 줄고 쉬운 문제로 돌아갑니다.`,
    solved: "푼 문제",
    bestStreak: "최고 연속",
    won: (s: string) => `${s}초를 남기고 모두 풀었습니다.`,
    lost: "시간이 끝났습니다.",
    streak: "연속 정답",
    solvedOf: (n: number, goal: number) => `${goal}문제 중 ${n}개`,
    levelN: (n: number) => `레벨 ${n}`,
    seconds: (s: string) => `${s}초`,
    answer: "답",
    answerHint: "답을 입력하고 Enter를 누르세요",
    back: "지우기",
    enter: "입력",
    correct: (points: number) => `정답, +${points}점`,
    wrong: (answer: number) => `오답, 정답은 ${answer}`,
  },
};

export default function MathBlitz() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [timeMs, setTimeMs] = useState(START_MS);
  const [solved, setSolved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => makeProblem(1));
  const [entry, setEntry] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackId = useRef(0);

  const finish = useCallback((won: boolean, finalScore: number) => {
    setPhase(won ? "won" : "lost");
    setFeedback(null);
    setBestScore((best) => (best === null || finalScore > best ? finalScore : best));
  }, []);

  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    setTimeMs(START_MS);
    setSolved(0);
    setStreak(0);
    setBestStreak(0);
    setProblem(makeProblem(1));
    setEntry("");
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      setTimeMs((t) => Math.max(0, t - TICK_MS));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "playing" && timeMs <= 0) finish(false, score);
  }, [phase, timeMs, score, finish]);

  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase, problem]);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 700);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const submit = useCallback(() => {
    if (phase !== "playing") return;
    const trimmed = entry.trim();
    if (trimmed === "") return;
    const guess = Number(trimmed);
    if (!Number.isFinite(guess)) return;

    feedbackId.current += 1;
    setEntry("");

    if (guess === problem.answer) {
      const nextStreak = streak + 1;
      const gained = 10 * levelFor(streak) + nextStreak * 2;
      const nextSolved = solved + 1;
      const nextScore = score + gained;

      setScore(nextScore);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setSolved(nextSolved);
      setFeedback({ id: feedbackId.current, kind: "correct", value: gained });

      if (nextSolved >= GOAL) {
        finish(true, nextScore);
        return;
      }
      setTimeMs((t) => Math.min(START_MS, t + BONUS_MS));
      setProblem(makeProblem(levelFor(nextStreak)));
      return;
    }

    setStreak(0);
    setFeedback({
      id: feedbackId.current,
      kind: "wrong",
      value: problem.answer,
    });
    setTimeMs((t) => Math.max(0, t - PENALTY_MS));
    setProblem(makeProblem(1));
  }, [phase, entry, problem, streak, solved, score, finish]);

  const pressKey = useCallback((key: string) => {
    if (key === "clear") {
      setEntry("");
      inputRef.current?.focus();
      return;
    }
    if (key === "back") {
      setEntry((v) => v.slice(0, -1));
      inputRef.current?.focus();
      return;
    }
    setEntry((v) => (v.length >= 4 ? v : v + key));
    inputRef.current?.focus();
  }, []);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">{m.intro(GOAL)}</p>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label={m.score} value={score} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label={m.solved} value={`${solved} / ${GOAL}`} size="sm" />
          <ScoreDisplay label={m.bestStreak} value={bestStreak} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won((timeMs / 1000).toFixed(1))
            : m.lost}
        </GameMessage>
        <GameButton onClick={startGame} size="xl">
          {m.playAgain}
        </GameButton>
      </div>
    );
  }

  const level = levelFor(streak);
  const timePct = Math.max(0, Math.min(100, (timeMs / START_MS) * 100));
  const lowTime = timeMs <= 10000;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label={m.score} value={score} highlight />
        <ScoreDisplay label={m.streak} value={streak} />
        <ScoreDisplay label={m.best} value={bestScore ?? "-"} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-widest text-game-muted">
          <span>{m.solvedOf(solved, GOAL)}</span>
          <span>{m.levelN(level)}</span>
          <span
            className={`tabular-nums ${lowTime ? "text-game-secondary" : "text-game-text-dim"}`}
          >
            {m.seconds((timeMs / 1000).toFixed(1))}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-game-surface border border-game-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ease-linear ${
              lowTime ? "bg-game-secondary" : "bg-game-accent"
            }`}
            style={{ width: `${timePct}%` }}
          />
        </div>
      </div>

      <div
        key={`${problem.a}-${problem.op}-${problem.b}`}
        className="rounded-2xl border-2 border-game-border bg-game-surface py-8 text-center animate-fade-in"
      >
        <p className="text-4xl font-black tabular-nums text-game-text">
          {problem.a} <span className="text-game-accent">{OP_LABEL[problem.op]}</span> {problem.b}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <GameInput
          ref={inputRef}
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="?"
          aria-label={m.answer}
          hint={m.answerHint}
        />
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
            <GameButton
              key={key}
              type="button"
              variant="secondary"
              size="lg"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pressKey(key)}
            >
              {key}
            </GameButton>
          ))}
          <GameButton
            type="button"
            variant="ghost"
            size="lg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pressKey("back")}
          >
            {m.back}
          </GameButton>
          <GameButton
            type="button"
            variant="secondary"
            size="lg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pressKey("0")}
          >
            0
          </GameButton>
          <GameButton type="submit" size="lg" disabled={entry.trim() === ""}>
            {m.enter}
          </GameButton>
        </div>
      </form>

      <div className="min-h-[3.25rem]">
        {feedback && (
          <div className="animate-fade-in">
            <GameMessage type={feedback.kind === "correct" ? "success" : "error"}>
              {feedback.kind === "correct" ? m.correct(feedback.value) : m.wrong(feedback.value)}
            </GameMessage>
          </div>
        )}
      </div>

      <GameButton variant="ghost" size="sm" onClick={() => finish(false, score)}>
        {m.quit}
      </GameButton>
    </div>
  );
}
