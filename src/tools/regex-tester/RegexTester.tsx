import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

const FLAGS = [
  { key: "g", label: "global" },
  { key: "i", label: "ignore case" },
  { key: "m", label: "multiline" },
  { key: "s", label: "dotall" },
  { key: "u", label: "unicode" },
  { key: "y", label: "sticky" },
] as const;

const MAX_MATCHES = 300;

interface MatchInfo {
  value: string;
  start: number;
  end: number;
  groups: string[];
  named: Array<{ name: string; value: string }>;
}

interface Segment {
  text: string;
  matched: boolean;
}

interface Result {
  matches: MatchInfo[];
  total: number;
  segments: Segment[];
  error: string;
}

const EMPTY: Result = { matches: [], total: 0, segments: [], error: "" };

function run(pattern: string, flags: string, text: string): Result {
  if (pattern === "") return EMPTY;

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "Invalid pattern" };
  }

  if (text === "") return EMPTY;

  const matches: MatchInfo[] = [];
  const segments: Segment[] = [];
  let total = 0;
  let cursor = 0;
  let guard = 0;
  let found: RegExpExecArray | null;

  while ((found = re.exec(text)) !== null) {
    if (guard++ > 100000) break;

    const start = found.index;
    const end = start + found[0].length;
    total += 1;

    if (matches.length < MAX_MATCHES) {
      matches.push({
        value: found[0],
        start,
        end,
        groups: found.slice(1).map((g) => (g === undefined ? "" : g)),
        named: Object.entries(found.groups ?? {}).map(([name, value]) => ({
          name,
          value: value === undefined ? "" : value,
        })),
      });

      if (start > cursor) segments.push({ text: text.slice(cursor, start), matched: false });
      if (end > start) segments.push({ text: found[0], matched: true });
      cursor = Math.max(cursor, end);
    }

    // A zero-length match would otherwise repeat forever at the same index.
    if (found[0] === "") re.lastIndex += 1;
    if (re.lastIndex > text.length) break;
    if (!flags.includes("g") && !flags.includes("y")) break;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });

  return { matches, total, segments, error: "" };
}

export default function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("");

  const result = useMemo(() => run(pattern, flags, text), [pattern, flags, text]);
  const hasMatches = result.matches.length > 0;
  const groupCount = hasMatches ? result.matches[0].groups.length : 0;
  const copyText = result.matches.map((m) => m.value).join("\n");

  const toggleFlag = (key: string) => {
    setFlags((prev) => (prev.includes(key) ? prev.replace(key, "") : prev + key));
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolInput
        label="Pattern"
        placeholder="\d{4}-\d{2}-\d{2}"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        spellCheck={false}
        className="font-mono"
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">Flags</span>
        <div className="flex flex-wrap gap-2">
          {FLAGS.map((flag) => (
            <ToolButton
              key={flag.key}
              size="sm"
              variant={flags.includes(flag.key) ? "primary" : "secondary"}
              onClick={() => toggleFlag(flag.key)}
            >
              <span className="font-mono">{flag.key}</span>
              <span className="hidden sm:inline">{flag.label}</span>
            </ToolButton>
          ))}
        </div>
      </div>

      <ToolTextarea
        label="Test text"
        placeholder="Paste the text you want to match against…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        className="font-mono"
      />

      <div className="flex gap-2">
        <ToolButton
          variant="ghost"
          onClick={() => {
            setPattern("");
            setText("");
          }}
          disabled={pattern === "" && text === ""}
        >
          Clear
        </ToolButton>
      </div>

      {result.error !== "" && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text">
          <span className="font-medium">Pattern is not valid yet.</span>{" "}
          <span className="text-tool-text-dim">{result.error}</span>
        </div>
      )}

      {result.error === "" && pattern !== "" && text !== "" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Matches" value={result.total} accent={result.total > 0} />
            <StatCard label="Capture groups" value={groupCount} />
            <StatCard
              label="Characters matched"
              value={result.matches.reduce((sum, m) => sum + m.value.length, 0)}
              sub={result.total > MAX_MATCHES ? `first ${MAX_MATCHES} shown` : undefined}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Highlighted text
            </span>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {result.segments.length === 0
                ? text
                : result.segments.map((seg, i) =>
                    seg.matched ? (
                      <mark
                        key={i}
                        className="rounded bg-tool-accent/20 text-tool-accent px-0.5"
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
            </div>
          </div>

          {hasMatches ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                  Match list
                </span>
                <CopyButton text={copyText} />
              </div>
              <div className="flex flex-col gap-2">
                {result.matches.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-tool-border bg-tool-surface p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-sm text-tool-text break-all">
                        {m.value === "" ? "(empty match)" : m.value}
                      </span>
                      <span className="text-xs text-tool-muted shrink-0">
                        {m.start}–{m.end}
                      </span>
                    </div>
                    {(m.groups.length > 0 || m.named.length > 0) && (
                      <div className="flex flex-col gap-1 border-t border-tool-border pt-2">
                        {m.groups.map((g, gi) => (
                          <div key={gi} className="flex gap-2 text-xs">
                            <span className="text-tool-muted shrink-0 w-14">group {gi + 1}</span>
                            <span className="font-mono text-tool-text-dim break-all">
                              {g === "" ? "—" : g}
                            </span>
                          </div>
                        ))}
                        {m.named.map((g) => (
                          <div key={g.name} className="flex gap-2 text-xs">
                            <span className="text-tool-muted shrink-0 w-14 truncate">{g.name}</span>
                            <span className="font-mono text-tool-text-dim break-all">
                              {g.value === "" ? "—" : g.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
              No matches in this text.
            </div>
          )}
        </>
      )}
    </div>
  );
}
