# /new-tool — Scaffold a new ctrlcat tool

You are creating a new web tool for ctrlcat.dev/tools/. Read `CLAUDE.md`, `.claude/add-tool.md`, `.claude/i18n.md` and `.claude/docs-guide.md` first; they are the source of truth for templates and rules.

## Step 1 — Gather info

Ask the user for:
1. **Tool name** (e.g. "Base64 Encoder")
2. **Description** (1–2 sentences, what it does)
3. **Category**: one of `text`, `math`, `color`, `data`, `image`, `developer`, `productivity`, `converter`
4. **Tags**: 3–6 keywords

Then derive `slug` (kebab-case) and `componentName` (PascalCase). The `icon` field is the slug; you draw the icon yourself in Step 4. Never use emoji.

## Step 2 — Content entry

Create `src/content/tools/<slug>.md` with the frontmatter from `.claude/add-tool.md`, including `localizations.ko`, and an English body written for non-developers.

## Step 3 — Component

Create `src/tools/<slug>/<ComponentName>.tsx` from the template in `.claude/add-tool.md`:
- every user-visible string lives in `const messages = { en, ko }` and is read with `useMessages`
- errors are stored as codes and rendered with `ToolNotice`
- colors come from Tailwind tokens (`tool-*`), never hex
- client-side only, default export

Implement the real logic completely.

## Step 4 — Icon, Korean doc, content list

- Add the icon block to `src/components/Icon.astro`
- Create `src/content/docs/tools/<slug>/ko.md`
- Add rows to `.claude/content.md`

## Step 5 — Verify

Run `npm run build`, fix any TypeScript errors, and check both `/tools/<slug>/` and `/ko/tools/<slug>/`.

## Rules

- Do not modify layouts, views, pages, renderers or config. Routing and component discovery are automatic.
- The component path must match the `component` field.
