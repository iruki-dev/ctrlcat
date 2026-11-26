import { useEffect, useRef, useState } from "react";
import { useLang, useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { QUESTIONS, type Category, type Question } from "./questions";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "reveal" | "won" | "lost";

const ROUND_LENGTH = 10;
const QUESTION_SECONDS = 15;
const WIN_THRESHOLD = 7;
const BASE_POINTS = 100;
const STREAK_BONUS = 25;
const TIME_BONUS = 5;

const messages = {
  en: {
    ...common.en,
    intro1: (s: number) => `Ten general knowledge questions, four choices each. You have ${s} seconds per question.`,
    intro2: (n: number) => `Answer faster and keep a streak going for more points. Get ${n} or more right to clear the round.`,
    keysHint: "Tap an answer, or press 1 to 4",
    correct: "Correct",
    bestStreak: "Best streak",
    won: (n: number, total: number) => `Round cleared with ${n} of ${total} correct.`,
    lost: (n: number, total: number, need: number) =>
      `Only ${n} of ${total} correct. You need ${need} to clear the round.`,
    bestSoFar: (score: number) => `Best score so far: ${score}`,
    streak: "Streak",
    questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
    seconds: (s: number) => `${s}s`,
    right: (points: number, streak: number) => `Correct. Plus ${points} points${streak > 1 ? `, streak of ${streak}` : ""}.`,
    timeUp: (answer: string) => `Time is up. The answer was ${answer}.`,
    wrong: (answer: string) => `Not quite. The answer was ${answer}.`,
    results: "See results",
    next: "Next question",
    categories: {
      Geography: "Geography", Science: "Science", Art: "Art", Sport: "Sport", History: "History", Music: "Music",
      Nature: "Nature", Numbers: "Numbers", Books: "Books", Body: "Body", Food: "Food", Language: "Language",
    } as Record<Category, string>,
  },
  ko: {
    ...common.ko,
    intro1: (s: number) => `상식 문제 10개가 4지선다로 나옵니다. 문제마다 ${s}초가 주어집니다.`,
    intro2: (n: number) => `빨리 맞히고 연속 정답을 이어 갈수록 점수가 커집니다. ${n}개 이상 맞히면 통과입니다.`,
    keysHint: "답을 누르거나 숫자 1~4 키를 누르세요",
    correct: "정답 수",
    bestStreak: "최고 연속",
    won: (n: number, total: number) => `${total}문제 중 ${n}개를 맞혀 통과했습니다.`,
    lost: (n: number, total: number, need: number) =>
      `${total}문제 중 ${n}개만 맞혔습니다. 통과하려면 ${need}개가 필요합니다.`,
    bestSoFar: (score: number) => `지금까지 최고 점수: ${score}`,
    streak: "연속 정답",
    questionOf: (n: number, total: number) => `${total}문제 중 ${n}번째`,
    seconds: (s: number) => `${s}초`,
    right: (points: number, streak: number) => `정답입니다. ${points}점 획득${streak > 1 ? `, ${streak}연속 정답` : ""}.`,
    timeUp: (answer: string) => `시간이 다 됐습니다. 정답은 ${answer}입니다.`,
    wrong: (answer: string) => `아쉽네요. 정답은 ${answer}입니다.`,
    results: "결과 보기",
    next: "다음 문제",
    categories: {
      Geography: "지리", Science: "과학", Art: "미술", Sport: "스포츠", History: "역사", Music: "음악",
      Nature: "자연", Numbers: "수", Books: "문학", Body: "인체", Food: "음식", Language: "언어",
    } as Record<Category, string>,
  },
};

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function TriviaQuiz() {
  const lang = useLang();
  const m = useMessages(messages);
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
  usePhaseEvents(phase, { playing: ["playing", "reveal"], score });

  const question = round[index];
  const text = question?.[lang];
  const inPlay = phase === "playing" || phase === "reveal";

  function startGame() {
    setRound(shuffle(QUESTIONS).slice(0, ROUND_LENGTH));
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
        if (phase === "idle") startGame();
        else afterBreak(startGame);
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
          <p className="text-game-text-dim">{m.intro1(QUESTION_SECONDS)}</p>
          <p className="text-game-text-dim">{m.intro2(WIN_THRESHOLD)}</p>
        </div>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
        <p className="text-xs text-game-muted">{m.keysHint}</p>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label={m.score} value={score} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label={m.correct} value={`${correct} / ${round.length}`} size="sm" />
          <ScoreDisplay label={m.bestStreak} value={bestStreak} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won(correct, round.length)
            : m.lost(correct, round.length, WIN_THRESHOLD)}
        </GameMessage>
        {bestScore !== null && (
          <p className="text-sm text-game-text-dim">{m.bestSoFar(bestScore)}</p>
        )}
        <GameButton onClick={() => afterBreak(startGame)} size="xl">
          {m.playAgain}
        </GameButton>
      </div>
    );
  }

  if (!question || !text) return null;

  const timeRatio = Math.max(0, Math.min(1, timeLeft / QUESTION_SECONDS));
  const lowTime = timeLeft <= 5;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label={m.score} value={score} size="sm" highlight />
        <ScoreDisplay label={m.streak} value={streak} size="sm" />
        <ScoreDisplay label={m.best} value={bestScore ?? "-"} size="sm" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-game-muted">
          <span>{m.questionOf(index + 1, round.length)}</span>
          <span className={lowTime ? "text-game-secondary" : "text-game-muted"}>
            {m.seconds(Math.ceil(timeLeft))}
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
          {m.categories[question.cat]}
        </span>
        <p className="text-lg font-semibold text-game-text">{text.q}</p>
      </div>

      <div className="flex flex-col gap-3">
        {text.a.map((option, i) => {
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
              key={i}
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
              ? m.right(gained, streak)
              : selected === -1
                ? m.timeUp(text.a[question.c])
                : m.wrong(text.a[question.c])}
          </GameMessage>
          <GameButton onClick={advance} size="lg">
            {index + 1 >= round.length ? m.results : m.next}
          </GameButton>
        </div>
      )}

      {inPlay && (
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          {m.quit}
        </GameButton>
      )}
    </div>
  );
}
