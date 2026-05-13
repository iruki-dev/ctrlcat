# ctrlcat

Fast, free web tools and games at [ctrlcat.dev](https://ctrlcat.dev).

- **Tools** → `ctrlcat.dev/tools/` — utilities that get things done
- **Games** → `ctrlcat.dev/games/` — quick browser games

No accounts. No tracking. No database. Fully static.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Astro 4](https://astro.build) | Static-first, zero JS by default, islands |
| UI | [React 18](https://react.dev) | Interactive tool/game components |
| Styling | [Tailwind CSS 3](https://tailwindcss.com) | Utility classes, custom design tokens |
| Content | Astro Content Collections | Type-safe registry for all tools & games |
| Hosting | GitHub Pages | Free static hosting |
| CI/CD | GitHub Actions | Auto-deploy on push to `main` |

---

## Project Structure

```
ctrlcat/
├── .claude/
│   └── commands/
│       ├── new-tool.md       ← /new-tool Claude command
│       └── new-game.md       ← /new-game Claude command
├── .github/
│   └── workflows/
│       └── deploy.yml        ← GitHub Actions deploy
├── public/
│   ├── CNAME                 ← ctrlcat.dev custom domain
│   └── favicon*.svg
├── src/
│   ├── content/
│   │   ├── config.ts         ← Collection schemas (source of truth)
│   │   ├── tools/            ← One .md per tool (metadata)
│   │   └── games/            ← One .md per game (metadata)
│   ├── tools/
│   │   └── <slug>/
│   │       └── <Component>.tsx   ← Tool implementation
│   ├── games/
│   │   └── <slug>/
│   │       └── <Component>.tsx   ← Game implementation
│   ├── components/
│   │   ├── tools/ui/         ← Shared tool UI blocks
│   │   └── games/ui/         ← Shared game UI blocks
│   ├── layouts/
│   │   ├── ToolLayout.astro  ← Wraps every tool page
│   │   ├── GameLayout.astro  ← Wraps every game page
│   │   └── LandingLayout.astro
│   ├── pages/
│   │   ├── index.astro       ← Landing (portal)
│   │   ├── tools/
│   │   │   ├── index.astro   ← Tool listing
│   │   │   └── [slug].astro  ← Dynamic tool page
│   │   └── games/
│   │       ├── index.astro   ← Game listing
│   │       └── [slug].astro  ← Dynamic game page
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

---

## Design System

Two completely independent visual themes share zero navigation:

### Tools theme — professional, teal-slate
```
bg-tool-bg        #0f1117   Page background
bg-tool-surface   #1a1d27   Card/panel background
border-tool-border #2a2d3e  Default border
text-tool-accent  #00d4aa   Brand accent (teal)
text-tool-text    #e2e8f0   Primary text
text-tool-text-dim #94a3b8  Secondary text
text-tool-muted   #6b7280   Muted/hint text
```

### Games theme — fun, purple-pink
```
bg-game-bg        #0d0d1a   Page background
bg-game-surface   #16162a   Card/panel background
border-game-border #2d2d4e  Default border
text-game-accent  #c084fc   Brand accent (purple)
text-game-secondary #f472b6 Secondary accent (pink)
text-game-text    #f1f5f9   Primary text
text-game-text-dim #a5b4fc  Secondary text
```

---

## Adding a New Tool

Use the Claude Code command:

```
/new-tool
```

Claude will ask for name, description, category, icon, and tags — then create both files automatically:

1. `src/content/tools/<slug>.md` — metadata entry (auto-listed, auto-routed)
2. `src/tools/<slug>/<ComponentName>.tsx` — React component with tool logic

**No other files need to be touched.**

### Tool categories
`text` · `math` · `color` · `data` · `image` · `developer` · `productivity` · `converter`

### Tool UI components (import from `../../components/tools/ui/`)
| Component | Usage |
|---|---|
| `ToolButton` | All buttons. `variant`: primary/secondary/ghost/danger. `size`: sm/md/lg |
| `ToolTextarea` | Multi-line text input with optional label/hint |
| `ToolInput` | Single-line input, supports `prefix`/`suffix` props |
| `StatCard` | Display a stat with label + value. `accent` prop for highlighted stat |
| `CopyButton` | Clipboard copy with confirmation state |

---

## Adding a New Game

Use the Claude Code command:

```
/new-game
```

Claude will ask for name, description, category, icon, tags, difficulty (1–5), and play time — then create:

1. `src/content/games/<slug>.md` — metadata entry
2. `src/games/<slug>/<ComponentName>.tsx` — React component with game logic

**No other files need to be touched.**

### Game categories
`puzzle` · `arcade` · `strategy` · `word` · `number` · `card` · `trivia`

### Game UI components (import from `../../components/games/ui/`)
| Component | Usage |
|---|---|
| `GameButton` | All buttons. `size`: sm/md/lg/xl |
| `GameInput` | Text/number input, centered, game-styled |
| `ScoreDisplay` | Score/stat display. `size`: sm/md/lg. `highlight` for accent |
| `GameMessage` | Feedback messages. `type`: info/success/warning/error/hint |

---

## Content Collection Schema

### Tool entry fields
```yaml
title: string           # Display name
description: string     # 1–2 sentence description
category: enum          # See tool categories above
icon: string            # Single emoji
tags: string[]          # 3–6 keywords
status: published|draft|wip
featured: boolean       # Show featured badge
publishedAt: date
component: string       # Path relative to src/tools/ (no .tsx)
```

### Game entry fields
```yaml
# (all tool fields, plus:)
difficulty: 1-5         # 1=Easy, 3=Medium, 5=Expert
playTime: number        # Estimated minutes per round
```

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # Build to dist/
npm run preview    # Preview built site
```

---

## Deployment

Push to `main` → GitHub Actions builds → deploys to GitHub Pages automatically.

**Setup (one-time):**
1. GitHub repo Settings → Pages → Source: "GitHub Actions"
2. Add custom domain `ctrlcat.dev` in Pages settings
3. DNS: point `ctrlcat.dev` CNAME/A records to GitHub Pages

---

## Conventions

- **One file = one tool/game.** Never modify shared layouts or config when adding content.
- **All logic is client-side.** No server functions, no fetch to external APIs (unless the tool explicitly needs it).
- **Slug is canonical.** The `.md` filename is the URL slug. `word-counter.md` → `/tools/word-counter/`
- **component field = file path.** `component: "word-counter/WordCounter"` → `src/tools/word-counter/WordCounter.tsx`
- **Tools and games never link to each other.** They are independent worlds.
