# ctrlcat

Free browser tools and games at [ctrlcat.dev](https://ctrlcat.dev), in English and Korean.

- **Tools** at `ctrlcat.dev/tools/`: 24 small utilities (text, data, color, developer, productivity)
- **Games** at `ctrlcat.dev/games/`: 22 quick browser games (puzzle, arcade, card, word, strategy)

No accounts, no tracking, no database. Everything runs in the browser on a fully static site.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Astro 4](https://astro.build), static output, React islands |
| UI | [React 18](https://react.dev) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com) with CSS-variable design tokens (light and dark) |
| Content | Astro content collections (one Markdown entry per tool or game) |
| i18n | `en` (default) and `ko` under `/ko/` |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main` |

---

## Project structure

```
src/
├── content/
│   ├── tools/<slug>.md          metadata + English article
│   ├── games/<slug>.md
│   └── docs/{tools,games}/<slug>/ko.md   Korean article
├── tools/<slug>/<Component>.tsx  tool implementation (en/ko strings inside)
├── tools/lib/                    shared tool helpers
├── games/<slug>/<Component>.tsx  game implementation (en/ko strings inside)
├── games/lib/                    canvas, game loop, input, best score, shared labels
├── components/                   renderers, shared UI, icons, illustrations, SEO head
├── views/                        page bodies shared by the en and ko routes
├── pages/                        thin routes (en at /, ko under /ko/)
├── layouts/                      tool, game and landing shells
├── i18n/                         Astro strings, locale helpers, React useMessages()
└── styles/global.css             design tokens
```

Pages are generated from the content collections, and components are discovered with `import.meta.glob`. Adding a tool or game does not touch routing, layouts or config.

Detailed internal notes live in `CLAUDE.md` and `.claude/` (architecture, design tokens, i18n, content lists, and step-by-step guides for adding a tool or game).

---

## Adding a tool or game

With Claude Code, run `/new-tool` or `/new-game`. By hand, follow `.claude/add-tool.md` or `.claude/add-game.md`. In short:

1. `src/content/<kind>s/<slug>.md`: frontmatter (with `localizations.ko`) and an English article
2. `src/<kind>s/<slug>/<Component>.tsx`: the component, with `const messages = { en, ko }`
3. An icon block in `src/components/Icon.astro` (games also need `GameIllustration.astro`)
4. `src/content/docs/<kind>s/<slug>/ko.md`: the Korean article

---

## Local development

```bash
npm ci
npm run dev        # http://localhost:4321
npm run build      # builds to dist/
npm run preview    # serves dist/
```

---

## Conventions

- All logic is client-side. No server functions and no external APIs.
- The `.md` filename is the URL slug, and `component: "word-counter/WordCounter"` points to `src/tools/word-counter/WordCounter.tsx`.
- Every user-visible string exists in both languages.
- Colors come from Tailwind tokens, not hex values.
- No emoji anywhere.
- Tools and games never link to each other.
