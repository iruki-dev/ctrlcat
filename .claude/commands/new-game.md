# /new-game — Scaffold a new ctrlcat game

You are creating a new browser game for ctrlcat.dev/games/. Follow these steps **exactly and completely** without asking for confirmation between steps.

## Step 1 — Gather info

Ask the user for:
1. **Game name** (e.g. "Color Match")
2. **Description** (1–2 sentences, how to play)
3. **Category** — must be one of: `puzzle`, `arcade`, `strategy`, `word`, `number`, `card`, `trivia`
4. **Icon** — one emoji
5. **Tags** — comma-separated keywords (3–6 tags)
6. **Difficulty** — 1 (Easy), 2 (Easy-Med), 3 (Medium), 4 (Hard), 5 (Expert)
7. **Play time** — estimated minutes per round (e.g. 2)

Then derive:
- `slug`: kebab-case of game name (e.g. `color-match`)
- `componentName`: PascalCase of game name (e.g. `ColorMatch`)

## Step 2 — Create content collection entry

Create file: `src/content/games/<slug>.md`

```markdown
---
title: "<Game Name>"
description: "<description>"
category: <category>
icon: "<emoji>"
tags: [<tags as yaml array>]
status: published
featured: false
publishedAt: <today's date YYYY-MM-DD>
component: "<slug>/<ComponentName>"
difficulty: <1-5>
playTime: <minutes>
---
```

## Step 3 — Create the game component

Create file: `src/games/<slug>/<ComponentName>.tsx`

Use this template — the game must be fully self-contained and playable:

```tsx
import { useState, useCallback } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { GameInput } from "../../components/games/ui/Input";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Phase = "idle" | "playing" | "won" | "lost";

export default function <ComponentName>() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    // TODO: initialize game state
  }, []);

  const endGame = useCallback((won: boolean) => {
    setPhase(won ? "won" : "lost");
    if (won && (bestScore === null || score > bestScore)) {
      setBestScore(score);
    }
  }, [score, bestScore]);

  // --- Idle screen ---
  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">Description of how to play…</p>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  // --- Result screen ---
  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Score" value={score} size="lg" highlight />
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won" ? "🎉 You won!" : "💀 Game over!"}
        </GameMessage>
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  // --- Playing screen ---
  return (
    <div className="max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        <ScoreDisplay label="Score" value={score} highlight />
        <ScoreDisplay label="Best" value={bestScore ?? "—"} />
      </div>

      {/* TODO: game UI here */}

      <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
        Quit
      </GameButton>
    </div>
  );
}
```

## Step 4 — Implement the actual game

Build a complete, fun, playable game. Requirements:
- Game must be self-contained (no external APIs, no server)
- Must have a clear win/lose condition
- Must have a score or progress indicator
- Must have a reset/replay button
- Must be playable with keyboard or mouse

Available UI components:

| Component | Import path | When to use |
|-----------|-------------|-------------|
| `GameButton` | `../../components/games/ui/Button` | All buttons (has `size` prop: sm/md/lg/xl) |
| `GameInput` | `../../components/games/ui/Input` | Text/number input |
| `ScoreDisplay` | `../../components/games/ui/ScoreDisplay` | Score, timer, lives display |
| `GameMessage` | `../../components/games/ui/GameMessage` | Feedback (success/error/hint/warning) |

**Tailwind classes for games theme:**
- Backgrounds: `bg-game-bg`, `bg-game-surface`
- Borders: `border-game-border` (use `border-2` for game elements)
- Text: `text-game-text`, `text-game-text-dim`, `text-game-muted`
- Accent (purple): `text-game-accent`, `bg-game-accent`, `border-game-accent`
- Secondary (pink): `text-game-secondary`, `bg-game-secondary`
- Animation: `animate-fade-in`, `animate-slide-up`, `animate-pulse-slow`
- Rounded: prefer `rounded-xl`, `rounded-2xl` for game elements

## Step 5 — Verify

Run `npm run build` to confirm no errors. Fix any TypeScript errors. Report the game URL: `ctrlcat.dev/games/<slug>/`

## Rules

- Do NOT modify any layout, page, config, or renderer file.
- Do NOT add routing — it is automatic via content collections.
- Do NOT touch `src/components/games/GameRenderer.tsx` — it uses `import.meta.glob` to auto-discover all files under `src/games/**/*.tsx`. New games are picked up automatically.
- The component file name MUST match the `component` field in the content entry.
- All game logic must be client-side only (no server, no DB, no canvas required).
- Default export the component function.
- The game must feel polished: smooth transitions, clear feedback, satisfying interactions.
