import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

/* ── class tokens used by the generated preview markup ───────────── */
const CLS = {
  h1: "text-2xl font-semibold text-tool-text mt-6 mb-3 first:mt-0",
  h2: "text-xl font-semibold text-tool-text mt-6 mb-2 first:mt-0",
  h3: "text-lg font-semibold text-tool-text mt-5 mb-2 first:mt-0",
  h4: "text-base font-semibold text-tool-text mt-4 mb-2 first:mt-0",
  h5: "text-sm font-semibold text-tool-text mt-4 mb-1 first:mt-0",
  h6: "text-sm font-semibold text-tool-muted mt-4 mb-1 first:mt-0",
  p: "text-sm leading-relaxed text-tool-text my-3",
  ul: "list-disc pl-6 my-3 space-y-1 text-sm leading-relaxed text-tool-text",
  ol: "list-decimal pl-6 my-3 space-y-1 text-sm leading-relaxed text-tool-text",
  quote:
    "border-l-4 border-tool-accent bg-tool-surface-2 pl-4 pr-3 py-1 my-3 text-tool-text-dim",
  pre: "bg-tool-surface-2 border border-tool-border rounded-lg p-3 my-3 overflow-x-auto",
  preCode: "font-mono text-xs leading-relaxed text-tool-text",
  code: "font-mono text-xs bg-tool-surface-2 text-tool-accent px-1.5 py-0.5 rounded",
  link: "text-tool-accent underline underline-offset-2 hover:text-tool-accent-dim",
  hr: "my-5 border-tool-border",
  img: "max-w-full rounded-lg my-3 border border-tool-border",
  table: "w-full my-3 text-sm border-collapse text-tool-text",
  th: "border border-tool-border bg-tool-surface-2 px-3 py-1.5 font-semibold",
  td: "border border-tool-border px-3 py-1.5 align-top",
};

const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s{0,3}&gt;/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Allow only navigable schemes; anything else collapses to a dead anchor. */
function safeUrl(raw: string): string {
  const url = raw.trim();
  if (/^(https?:|mailto:|#|\/|\.{0,2}\/)/i.test(url)) return url;
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(url)) return `mailto:${url}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "#";
  return url;
}

function renderInline(text: string): string {
  /* Finished markup is parked behind tokens so later rules cannot rewrite
     attributes such as target="_blank". */
  const tokens: string[] = [];
  const park = (html: string) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };
  const anchor = (href: string, label: string) =>
    `<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer" class="${CLS.link}">${label}</a>`;

  let out = text.replace(/(`+)([\s\S]*?)\1/g, (_m, _t, body: string) =>
    park(`<code class="${CLS.code}">${body.trim()}</code>`),
  );

  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) =>
      park(`<img src="${safeUrl(src)}" alt="${alt}" class="${CLS.img}" />`),
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      park(anchor(href, label)),
    )
    .replace(/&lt;((?:https?:\/\/|mailto:)[^\s&]+)&gt;/g, (_m, href: string) =>
      park(anchor(href, href)),
    )
    .replace(/~~([\s\S]+?)~~/g, "<del>$1</del>")
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([\s\S]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+?)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+?)_/g, "$1<em>$2</em>")
    .replace(/ {2,}\n/g, "<br />\n");

  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => tokens[Number(i)]);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string | undefined): boolean {
  return (
    typeof line === "string" &&
    line.includes("-") &&
    /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line)
  );
}

function alignStyle(cell: string): string {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return ' style="text-align:center"';
  if (right) return ' style="text-align:right"';
  return "";
}

function matchItem(line: string) {
  const ol = line.match(OL_RE);
  if (ol) return { indent: ol[1].length, ordered: true, text: ol[3], start: ol[2] };
  const ul = line.match(UL_RE);
  if (ul) return { indent: ul[1].length, ordered: false, text: ul[3], start: "1" };
  return null;
}

function renderList(lines: string[], from: number): [string, number] {
  const first = matchItem(lines[from]);
  if (!first) return ["", from + 1];

  const base = first.indent;
  const items: string[][] = [];
  let i = from;

  while (i < lines.length) {
    const line = lines[i];
    const item = matchItem(line);

    if (item && item.indent <= base + 1) {
      if (item.ordered !== first.ordered && items.length) break;
      items.push([item.text]);
      i += 1;
      continue;
    }
    if (!line.trim()) {
      const next = lines[i + 1];
      if (next && (matchItem(next) || /^\s{2,}\S/.test(next))) {
        items[items.length - 1]?.push("");
        i += 1;
        continue;
      }
      break;
    }
    if (items.length && /^\s{2,}\S/.test(line)) {
      items[items.length - 1].push(line.replace(new RegExp(`^\\s{0,${base + 2}}`), ""));
      i += 1;
      continue;
    }
    if (items.length && !/^\s*(#{1,6}\s|&gt;|```|~~~|\|)/.test(line)) {
      items[items.length - 1].push(line.trim());
      i += 1;
      continue;
    }
    break;
  }

  const body = items
    .map((content) => {
      const simple = content.length === 1 || content.every((l, idx) => idx === 0 || !l.trim());
      const inner = simple
        ? renderInline(content[0])
        : renderBlocks(content).replace(
            new RegExp(`^<p class="${CLS.p}">([\\s\\S]*?)</p>`),
            "$1",
          );
      return `<li>${inner}</li>`;
    })
    .join("");

  const tag = first.ordered ? "ol" : "ul";
  const startAttr =
    first.ordered && first.start !== "1" ? ` start="${Number(first.start)}"` : "";
  return [`<${tag}${startAttr} class="${first.ordered ? CLS.ol : CLS.ul}">${body}</${tag}>`, i];
}

function renderBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^\s*(```|~~~)\s*\S*\s*$/);
    if (fence) {
      const marker = fence[1];
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        buffer.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        `<pre class="${CLS.pre}"><code class="${CLS.preCode}">${buffer.join("\n")}</code></pre>`,
      );
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const cls = [CLS.h1, CLS.h2, CLS.h3, CLS.h4, CLS.h5, CLS.h6][level - 1];
      out.push(`<h${level} class="${cls}">${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push(`<hr class="${CLS.hr}" />`);
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && (QUOTE_RE.test(lines[i]) || lines[i].trim())) {
        if (!QUOTE_RE.test(lines[i]) && !buffer.length) break;
        buffer.push(lines[i].replace(/^\s{0,3}&gt;\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote class="${CLS.quote}">${renderBlocks(buffer)}</blockquote>`);
      continue;
    }

    if (line.trim().startsWith("|") && isTableDivider(lines[i + 1])) {
      const headers = splitRow(line);
      const aligns = splitRow(lines[i + 1]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const head = headers
        .map((cell, idx) => `<th class="${CLS.th}"${alignStyle(aligns[idx] ?? "")}>${renderInline(cell)}</th>`)
        .join("");
      const body = rows
        .map(
          (row) =>
            `<tr>${headers
              .map(
                (_h, idx) =>
                  `<td class="${CLS.td}"${alignStyle(aligns[idx] ?? "")}>${renderInline(row[idx] ?? "")}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      out.push(`<table class="${CLS.table}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    if (matchItem(line)) {
      const [html, next] = renderList(lines, i);
      out.push(html);
      i = next === i ? i + 1 : next;
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const current = lines[i];
      if (
        paragraph.length &&
        (matchItem(current) ||
          /^\s{0,3}(#{1,6}\s|&gt;|```|~~~)/.test(current) ||
          (current.trim().startsWith("|") && isTableDivider(lines[i + 1])))
      ) {
        break;
      }
      paragraph.push(current.replace(/^\s+/, ""));
      i += 1;
    }
    out.push(`<p class="${CLS.p}">${renderInline(paragraph.join("\n"))}</p>`);
  }

  return out.join("\n");
}

function markdownToHtml(source: string): string {
  if (!source.trim()) return "";
  return renderBlocks(escapeHtml(source.replace(/\r\n?/g, "\n")).split("\n"));
}

const SAMPLE = `# Release notes

A short intro paragraph with **bold text**, *italic text*, and \`inline code\`.

## Highlights

- Faster startup
- New export options
  - CSV
  - JSON
- Fixed a crash on save

1. Download the archive
2. Unpack it
3. Run the installer

> Upgrading is optional this month.

| Platform | Status | Size |
| --- | :---: | ---: |
| macOS | Ready | 42 MB |
| Windows | Ready | 48 MB |

\`\`\`
npm install
npm run build
\`\`\`

See the [documentation](https://example.com) for details.

---

Questions? Write to support@example.com.
`;

export default function MarkdownPreviewer() {
  const [source, setSource] = useState("");
  const [view, setView] = useState<"preview" | "html">("preview");

  const html = useMemo(() => markdownToHtml(source), [source]);

  const stats = useMemo(() => {
    const words = source.trim() ? source.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: source.length,
      lines: source ? source.split(/\n/).length : 0,
      minutes: words ? Math.max(1, Math.round(words / 200)) : 0,
    };
  }, [source]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        <ToolButton variant="secondary" onClick={() => setSource(SAMPLE)}>
          Load sample
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setSource("")} disabled={source === ""}>
          Clear
        </ToolButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ToolTextarea
          label="Markdown"
          hint="Headings, lists, tables, links, quotes and fenced code blocks are supported."
          placeholder="# Title&#10;&#10;Write Markdown here…"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={20}
          className="font-mono text-sm"
          spellCheck={false}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <ToolButton
                size="sm"
                variant={view === "preview" ? "secondary" : "ghost"}
                onClick={() => setView("preview")}
              >
                Preview
              </ToolButton>
              <ToolButton
                size="sm"
                variant={view === "html" ? "secondary" : "ghost"}
                onClick={() => setView("html")}
              >
                HTML
              </ToolButton>
            </div>
            {html && <CopyButton text={view === "html" ? html : source} />}
          </div>

          <div className="rounded-lg border border-tool-border bg-tool-surface p-4 min-h-[20rem] max-h-[36rem] overflow-auto">
            {html === "" ? (
              <p className="text-sm text-tool-muted">
                The rendered document appears here as you type.
              </p>
            ) : view === "preview" ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <pre className="font-mono text-xs leading-relaxed text-tool-text whitespace-pre-wrap break-all">
                {html}
              </pre>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Words" value={stats.words} accent />
        <StatCard label="Characters" value={stats.characters} />
        <StatCard label="Lines" value={stats.lines} />
        <StatCard label="Reading time" value={stats.minutes} sub="minutes" />
      </div>
    </div>
  );
}
