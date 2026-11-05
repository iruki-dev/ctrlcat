import { useCallback, useEffect, useMemo, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won";

type Pegs = number[][];

const DISC_OPTIONS = [3, 4, 5, 6, 7];
const MAX_DISCS = 7;

function buildPegs(discs: number): Pegs {
  const first: number[] = [];
  for (let size = discs; size >= 1; size -= 1) first.push(size);
  return [first, [], []];
}

function minimumMoves(discs: number): number {
  return Math.pow(2, discs) - 1;
}

function discWidth(size: number, total: number): string {
  const smallest = 34;
  const largest = 96;
  const step = total > 1 ? (largest - smallest) / (total - 1) : 0;
  return `${smallest + step * (size - 1)}%`;
}

function discColor(size: number): string {
  return size % 2 === 1 ? "bg-game-accent" : "bg-game-secondary";
}

export default function TowerOfHanoi() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [discs, setDiscs] = useState(4);
  const [pegs, setPegs] = useState<Pegs>(() => buildPegs(4));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Array<[number, number]>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [bestByDiscs, setBestByDiscs] = useState<Record<number, number>>({});

  const target = useMemo(() => minimumMoves(discs), [discs]);
  const best = bestByDiscs[discs];

  const startGame = useCallback((count: number) => {
    setDiscs(count);
    setPegs(buildPegs(count));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setNotice(null);
    setPhase("playing");
  }, []);

  const resetBoard = useCallback(() => {
    startGame(discs);
  }, [discs, startGame]);

  const finish = useCallback(
    (total: number) => {
      setBestByDiscs((prev) => {
        const current = prev[discs];
        if (current !== undefined && current <= total) return prev;
        return { ...prev, [discs]: total };
      });
      setPhase("won");
    },
    [discs],
  );

  const tapPeg = useCallback(
    (index: number) => {
      if (phase !== "playing") return;

      if (selected === null) {
        if (pegs[index].length === 0) {
          setNotice("That peg is empty. Pick a peg with a disc on it.");
          return;
        }
        setNotice(null);
        setSelected(index);
        return;
      }

      if (selected === index) {
        setSelected(null);
        setNotice(null);
        return;
      }

      const from = pegs[selected];
      const to = pegs[index];
      const disc = from[from.length - 1];
      const landing = to[to.length - 1];

      if (landing !== undefined && landing < disc) {
        setNotice("A larger disc cannot sit on a smaller one.");
        return;
      }

      const next = pegs.map((peg) => peg.slice());
      next[selected].pop();
      next[index].push(disc);

      const totalMoves = moves + 1;
      setPegs(next);
      setHistory((prev) => [...prev, [selected, index]]);
      setMoves(totalMoves);
      setSelected(null);
      setNotice(null);

      if (next[2].length === discs) finish(totalMoves);
    },
    [discs, finish, moves, pegs, phase, selected],
  );

  const undo = useCallback(() => {
    if (phase !== "playing" || history.length === 0) return;
    const [from, to] = history[history.length - 1];
    const next = pegs.map((peg) => peg.slice());
    const disc = next[to].pop();
    if (disc === undefined) return;
    next[from].push(disc);
    setPegs(next);
    setHistory((prev) => prev.slice(0, -1));
    setMoves((prev) => Math.max(0, prev - 1));
    setSelected(null);
    setNotice(null);
  }, [history, pegs, phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "1" || key === "2" || key === "3") {
        event.preventDefault();
        tapPeg(Number(key) - 1);
      } else if (key === "u") {
        event.preventDefault();
        undo();
      } else if (key === "r") {
        event.preventDefault();
        resetBoard();
      } else if (key === "escape") {
        event.preventDefault();
        setSelected(null);
        setNotice(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, resetBoard, tapPeg, undo]);

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          Move the whole stack to the right peg. Carry one disc at a time, and never place a larger
          disc on a smaller one.
        </p>
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-game-muted">
            Discs
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {DISC_OPTIONS.map((count) => (
              <GameButton
                key={count}
                size="md"
                variant={count === discs ? "primary" : "secondary"}
                onClick={() => setDiscs(count)}
                aria-pressed={count === discs}
              >
                {count}
              </GameButton>
            ))}
          </div>
          <span className="text-sm text-game-text-dim tabular-nums">
            Shortest solution: {minimumMoves(discs)} moves
          </span>
        </div>
        <GameButton onClick={() => startGame(discs)} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won") {
    const perfect = moves === target;
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Moves" value={moves} size="lg" highlight />
        <GameMessage type={perfect ? "success" : "info"}>
          {perfect
            ? `Perfect. You solved ${discs} discs in the minimum ${target} moves.`
            : `Solved with ${discs} discs in ${moves} moves. The minimum is ${target}.`}
        </GameMessage>
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Minimum" value={target} size="sm" />
          <ScoreDisplay label={`Best at ${discs}`} value={best ?? moves} size="sm" />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <GameButton onClick={resetBoard} size="xl">
            Play again
          </GameButton>
          <GameButton variant="secondary" size="xl" onClick={() => setPhase("idle")}>
            Change discs
          </GameButton>
        </div>
      </div>
    );
  }

  const moved = discs - pegs[0].length;

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Moves" value={moves} highlight />
        <ScoreDisplay label="Minimum" value={target} />
        <ScoreDisplay label="Best" value={best ?? "—"} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-game-surface border border-game-border">
          <div
            className="h-full rounded-full bg-game-accent transition-all duration-300"
            style={{ width: `${(pegs[2].length / discs) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-game-muted">
          {pegs[2].length} of {discs} discs home
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {pegs.map((peg, index) => {
          const isSelected = selected === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => tapPeg(index)}
              aria-label={`Peg ${index + 1}, ${peg.length} discs`}
              className={`group relative flex h-56 flex-col justify-end rounded-2xl border-2 p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2 ${
                isSelected
                  ? "border-game-accent bg-game-surface"
                  : "border-game-border bg-game-bg hover:border-game-accent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-4 bottom-6 w-1.5 -translate-x-1/2 rounded-full transition-colors duration-200 ${
                  isSelected ? "bg-game-accent" : "bg-game-border"
                }`}
              />
              <span className="relative flex flex-col-reverse items-center gap-1">
                {peg.map((size, position) => {
                  const lifted = isSelected && position === peg.length - 1;
                  return (
                    <span
                      key={size}
                      className={`flex items-center justify-center rounded-full text-[10px] font-black text-game-bg transition-all duration-200 ${discColor(
                        size,
                      )} ${lifted ? "-translate-y-2 ring-2 ring-game-accent" : ""}`}
                      style={{ width: discWidth(size, MAX_DISCS), height: "1.25rem" }}
                    >
                      {size}
                    </span>
                  );
                })}
              </span>
              <span
                aria-hidden="true"
                className={`relative mt-2 h-1.5 w-full rounded-full transition-colors duration-200 ${
                  isSelected ? "bg-game-accent" : "bg-game-border"
                }`}
              />
              <span className="relative mt-2 text-xs font-bold uppercase tracking-widest text-game-muted">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      <GameMessage type={notice ? "warning" : "hint"}>
        {notice ??
          (selected === null
            ? "Click a peg to lift its top disc, or press 1, 2, or 3."
            : `Disc ${pegs[selected][pegs[selected].length - 1]} lifted. Choose a peg to drop it on.`)}
      </GameMessage>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-game-muted tabular-nums">{moved} off the left peg</span>
        <div className="flex flex-wrap gap-2">
          <GameButton variant="secondary" size="sm" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
          <GameButton variant="secondary" size="sm" onClick={resetBoard}>
            Reset
          </GameButton>
          <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
            Quit
          </GameButton>
        </div>
      </div>
    </div>
  );
}
