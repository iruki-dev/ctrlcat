import { lazy, Suspense } from "react";
import GameShell from "./GameShell";

const gameModules = import.meta.glob<{ default: React.ComponentType }>(
  "/src/games/**/*.tsx"
);

const gameLazy: Record<string, React.LazyExoticComponent<React.ComponentType>> = {};
for (const [path, importFn] of Object.entries(gameModules)) {
  // '/src/games/number-guesser/NumberGuesser.tsx' → 'number-guesser/NumberGuesser'
  const key = path.replace("/src/games/", "").replace(".tsx", "");
  gameLazy[key] = lazy(importFn);
}

interface Props {
  component: string;
}

export default function GameRenderer({ component }: Props) {
  const Game = gameLazy[component];

  if (!Game) {
    return (
      <div className="rounded-2xl border-2 border-red-800/40 bg-red-900/10 p-8 text-center">
        <p className="text-red-400 font-bold">Component not found</p>
        <p className="text-game-muted font-mono text-sm mt-2">{component}.tsx</p>
        <p className="text-game-muted text-xs mt-1">
          Check the <code>component</code> field in the content entry.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<GameSkeleton />}>
      <GameShell>
        <Game />
      </GameShell>
    </Suspense>
  );
}

function GameSkeleton() {
  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-game-surface border-2 border-game-border" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-game-surface border-2 border-game-border" />
      <div className="h-14 rounded-xl bg-game-surface border-2 border-game-border" />
    </div>
  );
}
