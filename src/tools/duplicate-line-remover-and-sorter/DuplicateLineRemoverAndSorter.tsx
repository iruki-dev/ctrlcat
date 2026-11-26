import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type SortMode =
  | "original"
  | "alpha-asc"
  | "alpha-desc"
  | "numeric-asc"
  | "numeric-desc"
  | "length-asc"
  | "length-desc"
  | "random";

type OptionKey = "trim" | "dropEmpty" | "dedupe" | "ignoreCase";
type Options = Record<OptionKey, boolean>;

const messages = {
  en: {
    input: "Input",
    placeholder: "one entry per line\nsecond entry\nsecond entry",
    inputHint: "Paste your list. Each line is treated as one entry.",
    cleanup: "Cleanup",
    options: {
      trim: "Trim spaces at both ends",
      dropEmpty: "Drop empty lines",
      dedupe: "Remove duplicate lines",
      ignoreCase: "Ignore case when comparing",
    } as Record<OptionKey, string>,
    sortOrder: "Sort order",
    sorts: {
      original: "Original order",
      "alpha-asc": "Alphabetical (A to Z)",
      "alpha-desc": "Alphabetical (Z to A)",
      "numeric-asc": "Numeric (low to high)",
      "numeric-desc": "Numeric (high to low)",
      "length-asc": "Length (short to long)",
      "length-desc": "Length (long to short)",
      random: "Random shuffle",
    } as Record<SortMode, string>,
    shuffle: "Shuffle again",
    clear: "Clear",
    linesIn: "Lines in",
    linesOut: "Lines out",
    duplicatesRemoved: "Duplicates removed",
    emptiesRemoved: "Empty lines removed",
    output: "Output",
    empty: "Nothing left after cleanup.",
  },
  ko: {
    input: "입력",
    placeholder: "한 줄에 항목 하나\n두 번째 항목\n두 번째 항목",
    inputHint: "목록을 붙여넣으세요. 한 줄을 항목 하나로 봅니다.",
    cleanup: "정리",
    options: {
      trim: "앞뒤 공백 제거",
      dropEmpty: "빈 줄 제거",
      dedupe: "중복 줄 제거",
      ignoreCase: "비교할 때 대소문자 무시",
    } as Record<OptionKey, string>,
    sortOrder: "정렬 순서",
    sorts: {
      original: "원래 순서",
      "alpha-asc": "가나다순 (오름차순)",
      "alpha-desc": "가나다순 (내림차순)",
      "numeric-asc": "숫자 (작은 수부터)",
      "numeric-desc": "숫자 (큰 수부터)",
      "length-asc": "길이 (짧은 것부터)",
      "length-desc": "길이 (긴 것부터)",
      random: "무작위 섞기",
    } as Record<SortMode, string>,
    shuffle: "다시 섞기",
    clear: "지우기",
    linesIn: "입력 줄",
    linesOut: "결과 줄",
    duplicatesRemoved: "제거된 중복",
    emptiesRemoved: "제거된 빈 줄",
    output: "결과",
    empty: "정리 후 남은 줄이 없습니다.",
  },
};

function parseNumber(line: string): number | null {
  const cleaned = line.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Non-numeric lines sort to the end in both directions. */
function compareNumeric(a: string, b: string, descending: boolean): number {
  const na = parseNumber(a);
  const nb = parseNumber(b);
  if (na === null || nb === null) return (na === null ? 1 : 0) - (nb === null ? 1 : 0);
  return descending ? nb - na : na - nb;
}

/** Seeded shuffle so the order stays stable until "Shuffle again". */
function shuffle(lines: string[], seed: number): string[] {
  const out = lines.slice();
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sortLines(lines: string[], mode: SortMode, seed: number): string[] {
  const out = lines.slice();
  switch (mode) {
    case "alpha-asc":
      return out.sort((a, b) => a.localeCompare(b));
    case "alpha-desc":
      return out.sort((a, b) => b.localeCompare(a));
    case "numeric-asc":
      return out.sort((a, b) => compareNumeric(a, b, false));
    case "numeric-desc":
      return out.sort((a, b) => compareNumeric(a, b, true));
    case "length-asc":
      return out.sort((a, b) => a.length - b.length || a.localeCompare(b));
    case "length-desc":
      return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
    case "random":
      return shuffle(out, seed);
    default:
      return out;
  }
}

function clean(input: string, options: Options, mode: SortMode, seed: number) {
  const raw = input.split(/\r\n|\r|\n/);
  const trimmed = options.trim ? raw.map((line) => line.trim()) : raw;
  const nonEmpty = options.dropEmpty ? trimmed.filter((line) => line.trim() !== "") : trimmed;

  let unique = nonEmpty;
  if (options.dedupe) {
    const seen = new Set<string>();
    unique = nonEmpty.filter((line) => {
      const key = options.ignoreCase ? line.toLowerCase() : line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    lines: sortLines(unique, mode, seed),
    inputCount: raw.length,
    emptiesRemoved: trimmed.length - nonEmpty.length,
    duplicatesRemoved: nonEmpty.length - unique.length,
  };
}

export default function DuplicateLineRemoverAndSorter() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Options>({ trim: true, dropEmpty: true, dedupe: true, ignoreCase: false });
  const [mode, setMode] = useState<SortMode>("alpha-asc");
  const [seed, setSeed] = useState(1);

  const result = useMemo(() => (input === "" ? null : clean(input, options, mode, seed)), [input, options, mode, seed]);
  const output = result ? result.lines.join("\n") : "";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label={m.input}
        placeholder={m.placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        hint={m.inputHint}
      />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">{m.cleanup}</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(Object.keys(options) as OptionKey[]).map((key) => {
            const disabled = key === "ignoreCase" && !options.dedupe;
            return (
              <label key={key} className="flex items-center gap-2 text-sm text-tool-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={() => setOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
                  disabled={disabled}
                  className="h-4 w-4 accent-tool-accent"
                />
                <span className={disabled ? "text-tool-muted" : ""}>{m.options[key]}</span>
              </label>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">{m.sortOrder}</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SortMode)}
          className="w-full bg-tool-surface border border-tool-border px-3 py-2.5 text-tool-text text-sm focus:outline-none focus:ring-2 focus:ring-tool-accent focus:border-tool-accent transition-colors"
        >
          {(Object.keys(m.sorts) as SortMode[]).map((value) => (
            <option key={value} value={value}>
              {m.sorts[value]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {mode === "random" && (
          <ToolButton variant="secondary" onClick={() => setSeed((s) => s + 1)}>
            {m.shuffle}
          </ToolButton>
        )}
        <ToolButton variant="ghost" onClick={() => setInput("")} disabled={input === ""}>
          {m.clear}
        </ToolButton>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={m.linesIn} value={result.inputCount} />
            <StatCard label={m.linesOut} value={result.lines.length} accent />
            <StatCard label={m.duplicatesRemoved} value={result.duplicatesRemoved} />
            <StatCard label={m.emptiesRemoved} value={result.emptiesRemoved} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.output}</span>
              <CopyButton text={output} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all max-h-96 overflow-auto">
              {output === "" ? <span className="text-tool-muted">{m.empty}</span> : output}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
