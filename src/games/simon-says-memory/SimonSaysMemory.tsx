import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "watch" | "input" | "pause" | "won" | "lost";

const TARGET_ROUNDS = 20;

interface Pad {
  name: string;
  keys: string[];
  idle: string;
  lit: string;
}

const PADS: Pad[] = [
  {
    name: "violet",
    keys: ["1", "q"],
    idle: "bg-violet-500/50 hover:bg-violet-500/70",
    lit: "bg-violet-300",
  },
  {
    name: "pink",
    keys: ["2", "w"],
    idle: "bg-pink-500/50 hover:bg-pink-500/70",
    lit: "bg-pink-300",
  },
  {
    name: "sky",
    keys: ["3", "a"],
    idle: "bg-sky-500/50 hover:bg-sky-500/70",
    lit: "bg-sky-300",
  },
  {
    name: "amber",
    keys: ["4", "s"],
    idle: "bg-amber-500/50 hover:bg-amber-500/70",
    lit: "bg-amber-300",
  },
];

const messages = {
  en: {
    ...common.en,
    intro1: "Four pads flash in order. Repeat the order back by clicking the pads or pressing 1 to 4.",
    intro2: (rounds: number) => `Every round adds one more flash. Clear ${rounds} rounds to win.`,
    roundsCleared: "Rounds cleared",
    won: (rounds: number) => `Perfect memory. You repeated all ${rounds} rounds.`,
    lost: (len: number) => `Wrong pad on round ${len}. The sequence was ${len} flashes long.`,
    back: "Back",
    watch: "Watch the sequence",
    correct: "Correct. Next round coming up.",
    yourTurn: (step: number, len: number) => `Your turn: flash ${step} of ${len}`,
    rounds: "Rounds",
    length: "Length",
    pads: "Colour pads",
    padNames: ["Violet", "Pink", "Sky", "Amber"],
    padLabel: (name: string, key: number) => `${name} pad, key ${key}`,
    roundOf: (n: number, total: number) => `Round ${n} / ${total}`,
  },
  ko: {
    ...common.ko,
    intro1: "네 개의 패드가 순서대로 빛납니다. 패드를 클릭하거나 숫자 1~4를 눌러 같은 순서로 따라 하세요.",
    intro2: (rounds: number) => `라운드마다 깜빡임이 하나씩 늘어납니다. ${rounds}라운드를 통과하면 승리합니다.`,
    roundsCleared: "통과한 라운드",
    won: (rounds: number) => `완벽한 기억력입니다. ${rounds}라운드를 모두 따라 했습니다.`,
    lost: (len: number) => `${len}라운드에서 다른 패드를 눌렀습니다. 순서는 ${len}번 깜빡임이었습니다.`,
    back: "처음으로",
    watch: "순서를 잘 보세요",
    correct: "정답입니다. 곧 다음 라운드가 시작됩니다.",
    yourTurn: (step: number, len: number) => `내 차례: ${len}개 중 ${step}번째`,
    rounds: "라운드",
    length: "길이",
    pads: "색상 패드",
    padNames: ["보라", "분홍", "하늘", "주황"],
    padLabel: (name: string, key: number) => `${name} 패드, ${key}번 키`,
    roundOf: (n: number, total: number) => `라운드 ${n} / ${total}`,
  },
};

function randomPad(): number {
  return Math.floor(Math.random() * PADS.length);
}

export default function SimonSaysMemory() {
  const m = useMessages(messages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sequence, setSequence] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [wrongPad, setWrongPad] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const startGame = useCallback(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setSequence([randomPad()]);
    setStep(0);
    setScore(0);
    setActivePad(null);
    setWrongPad(null);
    setPhase("watch");
  }, []);

  const quitGame = useCallback(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setPhase("idle");
    setSequence([]);
    setStep(0);
    setActivePad(null);
    setWrongPad(null);
  }, []);

  /* Playback of the sequence */
  useEffect(() => {
    if (phase !== "watch") return;
    const gap = Math.max(280, 640 - sequence.length * 18);
    const on = Math.max(170, gap - 140);
    const lead = 650;
    const timers: number[] = [];

    sequence.forEach((pad, i) => {
      timers.push(window.setTimeout(() => setActivePad(pad), lead + i * gap));
      timers.push(
        window.setTimeout(() => setActivePad(null), lead + i * gap + on),
      );
    });
    timers.push(
      window.setTimeout(
        () => {
          setActivePad(null);
          setStep(0);
          setPhase("input");
        },
        lead + sequence.length * gap + 80,
      ),
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, sequence]);

  /* Short breather between a cleared round and the next sequence */
  useEffect(() => {
    if (phase !== "pause") return;
    const t = window.setTimeout(() => {
      setSequence((prev) => [...prev, randomPad()]);
      setPhase("watch");
    }, 750);
    return () => window.clearTimeout(t);
  }, [phase]);

  const finish = useCallback((won: boolean, finalScore: number) => {
    setBestScore((best) =>
      best === null || finalScore > best ? finalScore : best,
    );
    setPhase(won ? "won" : "lost");
  }, []);

  const press = useCallback(
    (pad: number) => {
      if (phase !== "input") return;

      setActivePad(pad);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setActivePad(null), 170);

      if (sequence[step] !== pad) {
        setWrongPad(pad);
        finish(false, score);
        return;
      }

      const next = step + 1;
      if (next < sequence.length) {
        setStep(next);
        return;
      }

      const earned = score + 1;
      setScore(earned);
      setStep(0);
      if (sequence.length >= TARGET_ROUNDS) finish(true, earned);
      else setPhase("pause");
    },
    [phase, sequence, step, score, finish],
  );

  /* Keyboard play */
  useEffect(() => {
    if (phase !== "input") return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const index = PADS.findIndex((pad) => pad.keys.includes(key));
      if (index === -1) return;
      event.preventDefault();
      press(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <div className="flex flex-col gap-3">
          <p className="text-game-text-dim">{m.intro1}</p>
          <p className="text-game-text-dim">{m.intro2(TARGET_ROUNDS)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-40">
          {PADS.map((pad) => (
            <div
              key={pad.name}
              className={`aspect-square rounded-2xl border-2 border-game-border ${pad.idle}`}
            />
          ))}
        </div>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label={m.roundsCleared} value={score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won(TARGET_ROUNDS)
            : m.lost(sequence.length)}
        </GameMessage>
        <ScoreDisplay label={m.best} value={bestScore ?? "-"} />
        <div className="flex gap-3">
          <GameButton onClick={startGame} size="xl">
            {m.playAgain}
          </GameButton>
          <GameButton variant="ghost" size="xl" onClick={quitGame}>
            {m.back}
          </GameButton>
        </div>
      </div>
    );
  }

  const statusText =
    phase === "watch"
      ? m.watch
      : phase === "pause"
        ? m.correct
        : m.yourTurn(step + 1, sequence.length);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-2">
        <ScoreDisplay label={m.rounds} value={score} size="sm" highlight />
        <ScoreDisplay label={m.length} value={sequence.length} size="sm" />
        <ScoreDisplay label={m.best} value={bestScore ?? "-"} size="sm" />
      </div>

      <GameMessage type={phase === "input" ? "hint" : "info"}>
        {statusText}
      </GameMessage>

      <div
        className="grid grid-cols-2 gap-2.5 w-full max-w-[260px] mx-auto"
        role="group"
        aria-label={m.pads}
      >
        {PADS.map((pad, index) => {
          const isLit = activePad === index;
          const isWrong = wrongPad === index;
          const look = isWrong
            ? "bg-red-400 border-red-600"
            : isLit
              ? `${pad.lit} border-game-text scale-95 shadow-md-2`
              : `${pad.idle} border-game-border`;
          return (
            <button
              key={pad.name}
              type="button"
              onClick={() => press(index)}
              disabled={phase !== "input"}
              aria-label={m.padLabel(m.padNames[index], index + 1)}
              className={`aspect-square rounded-2xl border-2 flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2 disabled:cursor-default ${look}`}
            >
              <span className="text-2xl font-black text-white tabular-nums drop-shadow">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-game-muted">
          {m.roundOf(sequence.length, TARGET_ROUNDS)}
        </span>
        <GameButton variant="ghost" size="sm" onClick={quitGame}>
          {m.quit}
        </GameButton>
      </div>
    </div>
  );
}
