# CLAUDE.md — ctrlcat development guide

This file is loaded automatically by Claude Code in every session. It defines the development workflow for ctrlcat.dev.

---

## Project overview

ctrlcat is a static site with two completely independent sections:
- `/tools/` — web utilities (zinc + cyan theme)
- `/games/` — browser games (zinc + violet theme)

Each section has a **sidebar** (collapsible on mobile, fixed on desktop) and renders content in a boxed card layer with documentation below.

**Critical constraint:** Tools and games must never link to each other.

---

## i18n system

Translations live in `src/i18n/`:
- `en.ts` — English strings (source of truth, typed)
- `ko.ts` — Korean strings (must satisfy `Translations` type)
- `index.ts` — `t(lang)`, `localePath()`, `switchLocalePath()` helpers

**Adding a new locale:**
1. Add the locale string to `locales` array in `src/i18n/index.ts`
2. Create `src/i18n/<locale>.ts` implementing the `Translations` type
3. Create `src/pages/<locale>/` mirroring the existing `ko/` structure

**Translating content titles/descriptions** — add to the content `.md` frontmatter:
```yaml
localizations:
  ko:
    title: "한국어 제목"
    description: "한국어 설명"
```

**UI string translation** — edit `src/i18n/ko.ts` (and other locale files). Never hardcode user-visible strings directly in `.astro` files — always use `t(lang).key`.

**Documentation body translation** — create a locale-specific doc file in the `docs` collection:
- Path: `src/content/docs/tools/<slug>/ko.md` (for a KO tool doc)
- Path: `src/content/docs/games/<slug>/ko.md` (for a KO game doc)
- Required frontmatter: `kind`, `ref` (tool/game slug), `lang`
- The KO slug page (`src/pages/ko/tools/[slug].astro`) auto-fetches this via `getEntry("docs", "tools/<slug>/ko")` and falls back to the English body if not found.

**URL structure:**
- English (default): `/tools/`, `/tools/word-counter/`, `/games/`
- Korean: `/ko/tools/`, `/ko/tools/word-counter/`, `/ko/games/`

---

## How to add a tool

```
/new-tool
```

This command handles everything. After running it, **do not touch**:
- `src/layouts/`
- `src/pages/`
- `src/content/config.ts`
- `tailwind.config.mjs`
- `astro.config.mjs`

Only two files are created per tool:
1. `src/content/tools/<slug>.md` — metadata
2. `src/tools/<slug>/<ComponentName>.tsx` — component

---

## How to add a game

```
/new-game
```

Only two files are created per game:
1. `src/content/games/<slug>.md` — metadata
2. `src/games/<slug>/<ComponentName>.tsx` — component

---

## UI rules

### Tools
- Import UI from `../../components/tools/ui/`
- Use `bg-tool-*`, `text-tool-*`, `border-tool-*` Tailwind classes
- Accent color: `#00d4aa` (teal)
- Animations: `animate-fade-in` on mount

### Games
- Import UI from `../../components/games/ui/`
- Use `bg-game-*`, `text-game-*`, `border-game-*` Tailwind classes
- Accent color: `#c084fc` (purple), secondary: `#f472b6` (pink)
- Use `border-2` for game UI borders (more prominent than tools)
- Rounded corners: prefer `rounded-xl` / `rounded-2xl`

---

## What NOT to do

- Do not create new pages manually — routing is automatic via content collections
- Do not add global CSS (use Tailwind classes only)
- Do not add a database or server-side logic
- Do not cross-link tools ↔ games
- Do not modify `src/content/config.ts` unless adding a new field to the schema
- Do not create shared components between tools and games realms

---

## Build & dev commands

```bash
npm run dev      # dev server (localhost:4321)
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
```

Build must pass before any commit. TypeScript errors are blocking.

---

## File naming rules

| What | Pattern |
|---|---|
| Tool slug | kebab-case, matches `.md` filename |
| Tool component | PascalCase, matches `component:` field |
| Tool dir | `src/tools/<slug>/` |
| Game slug | kebab-case, matches `.md` filename |
| Game component | PascalCase, matches `component:` field |
| Game dir | `src/games/<slug>/` |

Example: tool "Base64 Encoder"
- slug: `base64-encoder`
- md: `src/content/tools/base64-encoder.md`
- component field: `base64-encoder/Base64Encoder`
- tsx: `src/tools/base64-encoder/Base64Encoder.tsx`

---

## Content collection categories

**Tools:** `text` · `math` · `color` · `data` · `image` · `developer` · `productivity` · `converter`

**Games:** `puzzle` · `arcade` · `strategy` · `word` · `number` · `card` · `trivia`

---

## Deployment

- Hosting: GitHub Pages (custom domain: ctrlcat.dev)
- Deploy: auto on push to `main` via `.github/workflows/deploy.yml`
- Build output: `dist/` (Astro static build)
- CNAME: `public/CNAME` → `ctrlcat.dev`
