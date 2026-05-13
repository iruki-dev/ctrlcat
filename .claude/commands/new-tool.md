# /new-tool — Scaffold a new ctrlcat tool

You are creating a new web tool for ctrlcat.dev/tools/. Follow these steps **exactly and completely** without asking for confirmation between steps.

## Step 1 — Gather info

Ask the user for:
1. **Tool name** (e.g. "Base64 Encoder")
2. **Description** (1–2 sentences, what it does)
3. **Category** — must be one of: `text`, `math`, `color`, `data`, `image`, `developer`, `productivity`, `converter`
4. **Icon** — one emoji that represents the tool
5. **Tags** — comma-separated keywords (3–6 tags)

Then derive:
- `slug`: kebab-case of tool name (e.g. `base64-encoder`)
- `componentName`: PascalCase of tool name (e.g. `Base64Encoder`)

## Step 2 — Create content collection entry

Create file: `src/content/tools/<slug>.md`

```markdown
---
title: "<Tool Name>"
description: "<description>"
category: <category>
icon: "<emoji>"
tags: [<tags as yaml array>]
status: published
featured: false
publishedAt: <today's date YYYY-MM-DD>
component: "<slug>/<ComponentName>"
---
```

## Step 3 — Create the tool component

Create file: `src/tools/<slug>/<ComponentName>.tsx`

Use this template, adapting the implementation to what the tool actually does:

```tsx
import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

export default function <ComponentName>() {
  // --- State ---
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  // --- Logic ---
  const process = () => {
    // TODO: implement tool logic
    setOutput(input);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Input section */}
      <ToolTextarea
        label="Input"
        placeholder="Enter text…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
      />

      {/* Action */}
      <div className="flex gap-2">
        <ToolButton onClick={process} disabled={input === ""}>
          Convert
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => { setInput(""); setOutput(""); }}>
          Clear
        </ToolButton>
      </div>

      {/* Output */}
      {output && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">Output</span>
            <CopyButton text={output} />
          </div>
          <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
```

## Step 4 — Implement the actual logic

Replace the placeholder logic with a complete, working implementation. The tool must work correctly. Use the available UI components:

| Component | Import path | When to use |
|-----------|-------------|-------------|
| `ToolButton` | `../../components/tools/ui/Button` | All buttons |
| `ToolTextarea` | `../../components/tools/ui/Textarea` | Multi-line text input |
| `ToolInput` | `../../components/tools/ui/Input` | Single-line input, supports prefix/suffix |
| `StatCard` | `../../components/tools/ui/StatCard` | Display computed stats/numbers |
| `CopyButton` | `../../components/tools/ui/CopyButton` | Copy text to clipboard |

**Tailwind classes for tools theme:**
- Backgrounds: `bg-tool-bg`, `bg-tool-surface`
- Borders: `border-tool-border`
- Text: `text-tool-text`, `text-tool-text-dim`, `text-tool-muted`
- Accent: `text-tool-accent`, `bg-tool-accent`, `border-tool-accent`
- Animation: `animate-fade-in`, `animate-slide-up`

## Step 5 — Verify

Run `npm run build` to confirm the tool builds without errors. Fix any TypeScript errors. Report the tool URL: `ctrlcat.dev/tools/<slug>/`

## Rules

- Do NOT modify any layout, page, config, or renderer file.
- Do NOT add routing — it is automatic via content collections.
- Do NOT touch `src/components/tools/ToolRenderer.tsx` — it uses `import.meta.glob` to auto-discover all files under `src/tools/**/*.tsx`. New tools are picked up automatically.
- The component file name MUST match the `component` field in the content entry.
- All tool logic must be client-side only (no server, no DB).
- Default export the component function.
