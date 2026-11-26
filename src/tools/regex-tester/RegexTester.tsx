import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";

const FLAGS = ["g", "i", "m", "s", "u", "y"] as const;
type Flag = (typeof FLAGS)[number];

const MAX_MATCHES = 300;
const MAX_ITERATIONS = 100_000;

const messages = {
  en: {
    pattern: "Pattern",
    flags: "Flags",
    flagNames: { g: "global", i: "ignore case", m: "multiline", s: "dotall", u: "unicode", y: "sticky" } as Record<Flag, string>,
    testText: "Test text",
    testPlaceholder: "Paste the text you want to match against…",
    clear: "Clear",
    invalid: "Pattern is not valid yet.",
    matches: "Matches",
    groups: "Capture groups",
    matchedChars: "Characters matched",
    firstShown: (n: number) => `first ${n} shown`,
    highlighted: "Highlighted text",
    matchList: "Match list",
    emptyMatch: "(empty match)",
    group: (n: number) => `group ${n}`,
    noMatches: "No matches in this text.",
  },
  ko: {
    pattern: "패턴",
    flags: "플래그",
    flagNames: { g: "전체", i: "대소문자 무시", m: "여러 줄", s: "점이 줄바꿈 포함", u: "유니코드", y: "고정 위치" } as Record<Flag, string>,
    testText: "테스트 텍스트",
    testPlaceholder: "패턴을 적용할 텍스트를 붙여넣으세요…",
    clear: "지우기",
    invalid: "패턴이 아직 올바르지 않습니다.",
    matches: "일치",
    groups: "캡처 그룹",
    matchedChars: "일치한 글자 수",
    firstShown: (n: number) => `처음 ${n}개만 표시`,
    highlighted: "강조 표시",
    matchList: "일치 목록",
    emptyMatch: "(빈 일치)",
    group: (n: number) => `그룹 ${n}`,
    noMatches: "이 텍스트에는 일치하는 부분이 없습니다.",
  },
};

interface MatchInfo {
  value: string;
  start: number;
  end: number;
  groups: string[];
  named: [string, string][];
}

interface Result {
  matches: MatchInfo[];
  total: number;
  segments: { text: string; matched: boolean }[];
  error: string;
}

const EMPTY: Result = { matches: [], total: 0, segments: [], error: "" };

function run(pattern: string, flags: string, text: string): Result {
  if (pattern === "") return EMPTY;

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "" };
  }
  if (text === "") return EMPTY;

  const global = flags.includes("g") || flags.includes("y");
  const result: Result = { ...EMPTY, matches: [], segments: [] };
  let cursor = 0;
  let found: RegExpExecArray | null;

  for (let i = 0; i < MAX_ITERATIONS && (found = re.exec(text)) !== null; i++) {
    const start = found.index;
    const end = start + found[0].length;
    result.total += 1;

    if (result.matches.length < MAX_MATCHES) {
      result.matches.push({
        value: found[0],
        start,
        end,
        groups: found.slice(1).map((g) => g ?? ""),
        named: Object.entries(found.groups ?? {}).map(([name, value]) => [name, value ?? ""]),
      });
      if (start > cursor) result.segments.push({ text: text.slice(cursor, start), matched: false });
      if (end > start) result.segments.push({ text: found[0], matched: true });
      cursor = Math.max(cursor, end);
    }

    // A zero-length match would otherwise repeat forever at the same index.
    if (found[0] === "") re.lastIndex += 1;
    if (re.lastIndex > text.length || !global) break;
  }

  if (cursor < text.length) result.segments.push({ text: text.slice(cursor), matched: false });
  return result;
}

export default function RegexTester() {
  const m = useMessages(messages);
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("");

  const result = useMemo(() => run(pattern, flags, text), [pattern, flags, text]);
  const groupCount = result.matches[0]?.groups.length ?? 0;

  const toggleFlag = (key: Flag) => setFlags((prev) => (prev.includes(key) ? prev.replace(key, "") : prev + key));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolInput
        label={m.pattern}
        placeholder="\d{4}-\d{2}-\d{2}"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        spellCheck={false}
        className="font-mono"
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.flags}</span>
        <div className="flex flex-wrap gap-2">
          {FLAGS.map((flag) => (
            <ToolButton
              key={flag}
              size="sm"
              variant={flags.includes(flag) ? "primary" : "secondary"}
              aria-pressed={flags.includes(flag)}
              onClick={() => toggleFlag(flag)}
            >
              <span className="font-mono">{flag}</span>
              <span className="hidden sm:inline">{m.flagNames[flag]}</span>
            </ToolButton>
          ))}
        </div>
      </div>

      <ToolTextarea
        label={m.testText}
        placeholder={m.testPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
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
          {m.clear}
        </ToolButton>
      </div>

      {result.error !== "" && (
        <ToolNotice>
          <span className="font-medium">{m.invalid}</span> {result.error}
        </ToolNotice>
      )}

      {result.error === "" && pattern !== "" && text !== "" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label={m.matches} value={result.total} accent={result.total > 0} />
            <StatCard label={m.groups} value={groupCount} />
            <StatCard
              label={m.matchedChars}
              value={result.matches.reduce((sum, match) => sum + match.value.length, 0)}
              sub={result.total > MAX_MATCHES ? m.firstShown(MAX_MATCHES) : undefined}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.highlighted}</span>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {result.segments.map((seg, i) =>
                seg.matched ? (
                  <mark key={i} className="rounded bg-tool-accent/20 text-tool-accent px-0.5">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          </div>

          {result.matches.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.matchList}</span>
                <CopyButton text={result.matches.map((match) => match.value).join("\n")} />
              </div>
              <div className="flex flex-col gap-2">
                {result.matches.map((match, i) => (
                  <div key={i} className="rounded-lg border border-tool-border bg-tool-surface p-3 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-sm text-tool-text break-all">{match.value === "" ? m.emptyMatch : match.value}</span>
                      <span className="text-xs text-tool-muted shrink-0">
                        {match.start}–{match.end}
                      </span>
                    </div>
                    {(match.groups.length > 0 || match.named.length > 0) && (
                      <div className="flex flex-col gap-1 border-t border-tool-border pt-2">
                        {[...match.groups.map((g, gi) => [m.group(gi + 1), g]), ...match.named].map(([name, value], gi) => (
                          <div key={gi} className="flex gap-2 text-xs">
                            <span className="text-tool-muted shrink-0 w-14 truncate">{name}</span>
                            <span className="font-mono text-tool-text-dim break-all">{value === "" ? "—" : value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">{m.noMatches}</div>
          )}
        </>
      )}
    </div>
  );
}
