import { useCallback, useEffect, useState } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

const CODE_LENGTH = 4;
const MAX_ROUNDS = 10;

type Phase = "idle" | "playing" | "won" | "lost";

interface Feedback {
  exact: number;
  partial: number;
}

interface Row {
  guess: number[];
  feedback: Feedback;
}

const COLORS = [
  { name: "Rose", letter: "R", swatch: "bg-rose-500" },
  { name: "Amber", letter: "A", swatch: "bg-amber-400" },
  { name: "Emerald", letter: "E", swatch: "bg-emerald-500" },
  { name: "Sky", letter: "S", swatch: "bg-sky-500" },
  { name: "Indigo", letter: "I", swatch: "bg-indigo-500" },
  { name: "Fuchsia", letter: "F", swatch: "bg-fuchsia-500" },
];

const messages = {
  en: {
    ...common.en,
    colors: ["Rose", "Amber", "Emerald", "Sky", "Indigo", "Fuchsia"],
    empty: "Empty slot",
    intro1: "A secret code of four colours is hidden. Colours can repeat.",
    intro2: (rounds: number) =>
      `Each guess returns feedback: a filled peg for a right colour in the right slot, a hollow peg for a right colour in the wrong slot. You have ${rounds} guesses.`,
    won: (n: number) => `Code cracked in ${n} ${n === 1 ? "guess" : "guesses"}.`,
    lost: "Out of guesses.",
    theCode: "The code",
    guess: "Guess",
    remove: (name: string) => `Remove ${name}`,
    left: (n: number) => `${n} left`,
    feedback: (exact: number, partial: number) => `${exact} in place, ${partial} misplaced.`,
    pick: (name: string, key: number) => `${name} (key ${key})`,
    submit: "Submit",
    clear: "Clear",
  },
  ko: {
    ...common.ko,
    colors: ["장미", "호박", "에메랄드", "하늘", "남색", "자홍"],
    empty: "빈 칸",
    intro1: "네 가지 색으로 된 비밀 코드가 숨겨져 있습니다. 같은 색이 반복될 수 있습니다.",
    intro2: (rounds: number) =>
      `추측할 때마다 힌트가 나옵니다. 채워진 핀은 색과 위치가 모두 맞은 것, 빈 핀은 색은 맞지만 위치가 다른 것입니다. 기회는 ${rounds}번입니다.`,
    won: (n: number) => `${n}번 만에 코드를 풀었습니다.`,
    lost: "기회를 모두 썼습니다.",
    theCode: "정답 코드",
    guess: "추측",
    remove: (name: string) => `${name} 빼기`,
    left: (n: number) => `${n}번 남음`,
    feedback: (exact: number, partial: number) => `위치까지 맞음 ${exact}개, 색만 맞음 ${partial}개.`,
    pick: (name: string, key: number) => `${name} (${key}번 키)`,
    submit: "제출",
    clear: "지우기",
  },
};

function makeSecret(): number[] {
  return Array.from({ length: CODE_LENGTH }, () =>
    Math.floor(Math.random() * COLORS.length),
  );
}

function evaluate(guess: number[], secret: number[]): Feedback {
  let exact = 0;
  const guessLeft: number[] = [];
  const secretLeft: number[] = [];

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      exact++;
    } else {
      guessLeft.push(guess[i]);
      secretLeft.push(secret[i]);
    }
  }

  const pool = new Map<number, number>();
  for (const c of secretLeft) pool.set(c, (pool.get(c) ?? 0) + 1);

  let partial = 0;
  for (const c of guessLeft) {
    const left = pool.get(c) ?? 0;
    if (left > 0) {
      partial++;
      pool.set(c, left - 1);
    }
  }

  return { exact, partial };
}

function Peg({ color, dim }: { color: number | null; dim?: boolean }) {
  const m = useMessages(messages);
  if (color === null) {
    return (
      <div
        className={`h-10 w-10 rounded-full border-2 border-dashed border-game-border-dim ${
          dim ? "" : "bg-game-surface-2"
        }`}
        aria-label={m.empty}
      />
    );
  }
  const c = COLORS[color];
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-black text-white shadow-md-1 transition-transform duration-200 ${c.swatch}`}
      aria-label={m.colors[color]}
    >
      {c.letter}
    </div>
  );
}

function FeedbackPegs({ feedback }: { feedback: Feedback }) {
  const total = CODE_LENGTH;
  const pegs = Array.from({ length: total }, (_, i) => {
    if (i < feedback.exact) return "exact";
    if (i < feedback.exact + feedback.partial) return "partial";
    return "none";
  });

  return (
    <div className="grid w-10 grid-cols-2 gap-1">
      {pegs.map((kind, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border ${
            kind === "exact"
              ? "border-game-text bg-game-text"
              : kind === "partial"
                ? "border-game-text bg-game-bg"
                : "border-game-border-dim bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export default function Mastermind() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secret, setSecret] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const startGame = useCallback(() => {
    setSecret(makeSecret());
    setRows([]);
    setCurrent([]);
    setScore(0);
    setPhase("playing");
  }, []);

  const place = useCallback(
    (color: number) => {
      setCurrent((prev) =>
        prev.length >= CODE_LENGTH ? prev : [...prev, color],
      );
    },
    [],
  );

  const removeAt = useCallback((index: number) => {
    setCurrent((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const backspace = useCallback(() => {
    setCurrent((prev) => prev.slice(0, -1));
  }, []);

  const submit = useCallback(() => {
    if (current.length !== CODE_LENGTH) return;

    const feedback = evaluate(current, secret);
    const nextRows = [...rows, { guess: current, feedback }];
    setRows(nextRows);
    setCurrent([]);

    if (feedback.exact === CODE_LENGTH) {
      const earned = 200 + (MAX_ROUNDS - nextRows.length) * 100;
      setScore(earned);
      setBestScore((best) => (best === null || earned > best ? earned : best));
      setPhase("won");
      return;
    }

    if (nextRows.length >= MAX_ROUNDS) {
      setScore(0);
      setPhase("lost");
    }
  }, [current, secret, rows]);

  useEffect(() => {
    if (phase !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= String(COLORS.length)) {
        e.preventDefault();
        place(Number(e.key) - 1);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, place, backspace, submit]);

  if (phase === "idle") {
    return (
      <div className="mx-auto flex max-w-md animate-fade-in flex-col items-center gap-8 py-8 text-center">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Peg key={i} color={i} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">{m.intro1}</p>
          <p className="text-game-text-dim">{m.intro2(MAX_ROUNDS)}</p>
        </div>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="mx-auto flex max-w-md animate-slide-up flex-col items-center gap-6 py-8 text-center">
        <ScoreDisplay label={m.score} value={score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won(rows.length)
            : m.lost}
        </GameMessage>
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-game-muted">
            {m.theCode}
          </span>
          <div className="flex gap-2">
            {secret.map((c, i) => (
              <Peg key={i} color={c} />
            ))}
          </div>
        </div>
        {bestScore !== null && (
          <ScoreDisplay label={m.best} value={bestScore} size="sm" />
        )}
        <GameButton onClick={startGame} size="xl">
          {m.playAgain}
        </GameButton>
      </div>
    );
  }

  const guessesLeft = MAX_ROUNDS - rows.length;
  const ready = current.length === CODE_LENGTH;
  const last = rows[rows.length - 1];

  return (
    <div className="mx-auto flex max-w-md animate-fade-in flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <ScoreDisplay label={m.guess} value={`${rows.length + 1} / ${MAX_ROUNDS}`} highlight />
        <ScoreDisplay label={m.best} value={bestScore ?? "-"} />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border-2 border-game-border bg-game-surface p-4">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex animate-slide-up items-center justify-between gap-4"
          >
            <span className="w-5 text-right text-xs font-bold tabular-nums text-game-muted">
              {i + 1}
            </span>
            <div className="flex gap-2">
              {row.guess.map((c, j) => (
                <Peg key={j} color={c} />
              ))}
            </div>
            <FeedbackPegs feedback={row.feedback} />
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 rounded-xl bg-game-accent-light p-2">
          <span className="w-5 text-right text-xs font-bold tabular-nums text-game-accent">
            {rows.length + 1}
          </span>
          <div className="flex gap-2">
            {Array.from({ length: CODE_LENGTH }, (_, i) =>
              i < current.length ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={m.remove(m.colors[current[i]])}
                  className="rounded-full transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2"
                >
                  <Peg color={current[i]} />
                </button>
              ) : (
                <Peg key={i} color={null} dim />
              ),
            )}
          </div>
          <div className="w-10 text-center text-xs font-bold tabular-nums text-game-accent">
            {m.left(guessesLeft)}
          </div>
        </div>
      </div>

      {last && (
        <GameMessage type="hint">
          {m.feedback(last.feedback.exact, last.feedback.partial)}
        </GameMessage>
      )}

      <div className="flex justify-center gap-2">
        {COLORS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            onClick={() => place(i)}
            disabled={current.length >= CODE_LENGTH}
            aria-label={m.pick(m.colors[i], i + 1)}
            className={`flex h-12 w-12 flex-col items-center justify-center rounded-full text-xs font-black text-white shadow-md-1 transition-all duration-200 hover:scale-110 hover:shadow-md-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2 ${c.swatch}`}
          >
            <span>{c.letter}</span>
            <span className="text-[0.6rem] font-bold opacity-80">{i + 1}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <GameButton onClick={submit} disabled={!ready} size="lg">
          {m.submit}
        </GameButton>
        <GameButton
          variant="secondary"
          size="lg"
          onClick={() => setCurrent([])}
          disabled={current.length === 0}
        >
          {m.clear}
        </GameButton>
      </div>

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        {m.quit}
      </GameButton>
    </div>
  );
}
