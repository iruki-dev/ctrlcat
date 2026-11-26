import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang, useMessages } from "../../i18n/react";
import type { Locale } from "../../i18n";
import { common } from "../lib/messages";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "solved" | "won" | "lost";

interface Puzzle {
  word: string;
  hint: Record<Locale, string>;
}

const PUZZLES: Puzzle[] = [
  { word: "HARBOR", hint: { en: "Where boats wait out the weather", ko: "배가 궂은 날씨를 피해 머무는 곳" } },
  { word: "LANTERN", hint: { en: "A light you can carry", ko: "들고 다닐 수 있는 등불" } },
  { word: "MARBLE", hint: { en: "A small glass sphere, or a kind of stone", ko: "작은 유리구슬, 또는 돌의 한 종류" } },
  { word: "ORCHARD", hint: { en: "A field planted with fruit trees", ko: "과일나무를 심은 밭" } },
  { word: "WHISPER", hint: { en: "Speech almost too quiet to hear", ko: "거의 들리지 않을 만큼 작은 말소리" } },
  { word: "COMPASS", hint: { en: "It always points the same way", ko: "늘 같은 방향을 가리키는 도구" } },
  { word: "BLANKET", hint: { en: "You pull it up when the room is cold", ko: "방이 추울 때 끌어 덮는 것" } },
  { word: "JOURNEY", hint: { en: "A long trip from one place to another", ko: "한 곳에서 다른 곳으로 가는 긴 여정" } },
  { word: "SILVER", hint: { en: "A bright metal, second place at the games", ko: "빛나는 금속, 대회의 2등" } },
  { word: "THUNDER", hint: { en: "The sound that follows lightning", ko: "번개 뒤에 따라오는 소리" } },
  { word: "PUZZLE", hint: { en: "Something built to be worked out", ko: "풀어내라고 만든 것" } },
  { word: "GARDEN", hint: { en: "A patch of ground you tend", ko: "가꾸며 돌보는 땅" } },
  { word: "MIRROR", hint: { en: "It shows you back to yourself", ko: "내 모습을 비춰 주는 것" } },
  { word: "CANDLE", hint: { en: "Wax with a wick", ko: "심지가 박힌 밀랍" } },
  { word: "FOREST", hint: { en: "Trees for as far as you can walk", ko: "걸어도 걸어도 이어지는 나무들" } },
  { word: "RIBBON", hint: { en: "A thin strip tied in a bow", ko: "나비 모양으로 묶는 얇은 끈" } },
  { word: "VELVET", hint: { en: "Fabric with a soft nap", ko: "보드라운 털이 있는 천" } },
  { word: "MONSOON", hint: { en: "A season of heavy rain", ko: "큰비가 이어지는 계절" } },
  { word: "QUARRY", hint: { en: "Where stone is cut from the ground", ko: "땅에서 돌을 캐내는 곳" } },
  { word: "SHADOW", hint: { en: "It follows you on a sunny day", ko: "맑은 날 나를 따라다니는 것" } },
  { word: "TRUMPET", hint: { en: "A brass instrument with three valves", ko: "밸브가 세 개인 금관악기" } },
  { word: "WINDOW", hint: { en: "A hole in the wall with glass in it", ko: "유리를 끼운 벽의 구멍" } },
  { word: "ANCHOR", hint: { en: "It holds a ship in place", ko: "배를 한자리에 붙잡아 두는 것" } },
  { word: "BRIDGE", hint: { en: "It carries a road over water", ko: "물 위로 길을 이어 주는 것" } },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_MISSES = 6;
const ROUND_COUNT = 8;

const messages = {
  en: {
    ...common.en,
    intro1: "Guess the hidden word one letter at a time. Six wrong guesses and the run is over.",
    intro2: "Eight words per run. Every chance you have left at the end of a word is worth extra points.",
    won: (n: number) => `You cleared all ${n} words.`,
    lostWord: (word: string) => `Out of chances. The word was ${word}.`,
    lost: "Out of chances.",
    word: "Word",
    chances: "Chances",
    hiddenWord: "Hidden word",
    solved: (gain: number, left: number) => `Solved for ${gain} points. ${left} words left.`,
    nextWord: "Next word",
    guessLetter: (l: string) => `Guess ${l}`,
    missed: (letters: string) => `Missed: ${letters}`,
    typeHint: "Type a letter or tap the keyboard.",
    gallows: (misses: number, max: number) => `${misses} of ${max} wrong guesses`,
  },
  ko: {
    ...common.ko,
    intro1: "숨겨진 영어 단어를 한 글자씩 맞혀 보세요. 여섯 번 틀리면 게임이 끝납니다.",
    intro2: "한 판에 여덟 단어가 나옵니다. 단어를 맞혔을 때 남은 기회만큼 추가 점수를 받습니다.",
    won: (n: number) => `${n}개 단어를 모두 맞혔습니다.`,
    lostWord: (word: string) => `기회를 모두 썼습니다. 정답은 ${word}였습니다.`,
    lost: "기회를 모두 썼습니다.",
    word: "단어",
    chances: "남은 기회",
    hiddenWord: "숨겨진 단어",
    solved: (gain: number, left: number) => `${gain}점을 얻었습니다. ${left}개 단어가 남았습니다.`,
    nextWord: "다음 단어",
    guessLetter: (l: string) => `${l} 추측`,
    missed: (letters: string) => `틀린 글자: ${letters}`,
    typeHint: "키보드로 입력하거나 아래 글자를 누르세요.",
    gallows: (misses: number, max: number) => `${max}번 중 ${misses}번 틀림`,
  },
};

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
  const lang = useLang();
  const m = useMessages(messages);
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
          <p className="text-game-text-dim">{m.intro1}</p>
          <p className="text-game-text-dim text-sm">{m.intro2}</p>
        </div>
        <GameButton onClick={startRun} size="xl">
          {m.start}
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
          <ScoreDisplay label={m.score} value={score} size="lg" highlight />
          <ScoreDisplay label={m.best} value={bestScore ?? score} size="lg" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won(ROUND_COUNT)
            : answer
              ? m.lostWord(answer)
              : m.lost}
        </GameMessage>
        <GameButton onClick={startRun} size="xl">
          {m.playAgain}
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
        <ScoreDisplay label={m.score} value={score} highlight />
        <ScoreDisplay label={m.word} value={`${round + 1} / ${deck.length}`} />
        <ScoreDisplay label={m.chances} value={livesLeft} />
      </div>

      <div className="flex flex-col items-center gap-4">
        <Gallows misses={misses} />
        <p className="text-game-text-dim text-sm text-center">{puzzle.hint[lang]}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-label={m.hiddenWord}>
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
            {m.solved(lastGain, deck.length - round - 1)}
          </GameMessage>
          <GameButton onClick={nextRound} size="lg">
            {m.nextWord}
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
                  aria-label={m.guessLetter(letter)}
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
            {wrongLetters.length > 0 ? m.missed(wrongLetters.join(" ")) : m.typeHint}
          </p>
        </div>
      )}

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        {m.quit}
      </GameButton>
    </div>
  );
}

function Gallows({ misses }: { misses: number }) {
  const m = useMessages(messages);
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
      aria-label={m.gallows(misses, MAX_MISSES)}
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
