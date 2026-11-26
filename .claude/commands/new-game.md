# /new-game — Scaffold a new ctrlcat game

You are creating a new browser game for ctrlcat.dev/games/. Read `CLAUDE.md`, `.claude/add-game.md`, `.claude/i18n.md` and `.claude/docs-guide.md` first; they are the source of truth for templates and rules.

## Step 1 — Gather info

Ask the user for:
1. **Game name** (e.g. "Color Match"). Avoid trademarked names of existing games.
2. **Description** (1–2 sentences, how to play)
3. **Category**: one of `puzzle`, `arcade`, `strategy`, `word`, `number`, `card`, `trivia`
4. **Tags**: 3–6 keywords
5. **Difficulty**: 1 (Easy) to 5 (Expert)
6. **Play time**: estimated minutes per round

Then derive `slug` (kebab-case) and `componentName` (PascalCase). The `icon` field is the slug; you draw the icon and illustration yourself in Step 4. Never use emoji.

## Step 2 — Content entry

Create `src/content/games/<slug>.md` with the frontmatter from `.claude/add-game.md`, including `localizations.ko`, and an English body written for non-developers.

## Step 3 — Component

Create `src/games/<slug>/<ComponentName>.tsx` from a template in `.claude/add-game.md`:
- every user-visible string lives in `const messages = { en: { ...common.en, ... }, ko: { ...common.ko, ... } }`
- persistent best scores use `useBestScore`
- DOM colors come from Tailwind tokens (`game-*`); canvas colors are constants at the top of the file
- clear win/lose condition, score or progress, replay button, keyboard or mouse play
- client-side only, default export

## Step 4 — Icon, illustration, Korean doc, content list

- Add the icon block to `src/components/Icon.astro`
- Add the illustration block to `src/components/GameIllustration.astro`
- Create `src/content/docs/games/<slug>/ko.md`
- Add rows to `.claude/content.md`

## Step 5 — Verify

Run `npm run build`, fix any TypeScript errors, and play both `/games/<slug>/` and `/ko/games/<slug>/`.

## Rules

- Do not modify layouts, views, pages, renderers or config. Routing and component discovery are automatic.
- The component path must match the `component` field.
