import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type SortMode =
  | "original"
  | "alpha-asc"
  | "alpha-desc"
  | "numeric-asc"
  | "numeric-desc"
  | "length-asc"
  | "length-desc"
  | "random";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "original", label: "Original order" },
  { value: "alpha-asc", label: "Alphabetical (A to Z)" },
  { value: "alpha-desc", label: "Alphabetical (Z to A)" },
  { value: "numeric-asc", label: "Numeric (low to high)" },
  { value: "numeric-desc", label: "Numeric (high to low)" },
  { value: "length-asc", label: "Length (short to long)" },
  { value: "length-desc", label: "Length (long to short)" },
  { value: "random", label: "Random shuffle" },
];

interface Options {
  trim: boolean;
  dropEmpty: boolean;
  dedupe: boolean;
  ignoreCase: boolean;
}

interface Result {
  lines: string[];
  inputCount: number;
  duplicatesRemoved: number;
  emptiesRemoved: number;
}

function parseNumber(line: string): number | null {
  const cleaned = line.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function compareNumeric(a: string, b: string, descending: boolean): number {
  const na = parseNumber(a);
  const nb = parseNumber(b);
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  return descending ? nb - na : na - nb;
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
    case "random": {
      let state = seed || 1;
      for (let i = out.length - 1; i > 0; i -= 1) {
        state = (state * 1664525 + 1013904223) % 4294967296;
        const j = state % (i + 1);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    }
    default:
      return out;
  }
}

function clean(input: string, options: Options, mode: SortMode, seed: number): Result {
  const raw = input.split(/\r\n|\r|\n/);
  const inputCount = raw.length;

  const trimmed = options.trim ? raw.map((line) => line.trim()) : raw;

  let emptiesRemoved = 0;
  const nonEmpty = options.dropEmpty
    ? trimmed.filter((line) => {
        if (line.trim() === "") {
          emptiesRemoved += 1;
          return false;
        }
        return true;
      })
    : trimmed;

  let duplicatesRemoved = 0;
  let unique = nonEmpty;
  if (options.dedupe) {
    const seen = new Set<string>();
    unique = nonEmpty.filter((line) => {
      const key = options.ignoreCase ? line.toLowerCase() : line;
      if (seen.has(key)) {
        duplicatesRemoved += 1;
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return {
    lines: sortLines(unique, mode, seed),
    inputCount,
    duplicatesRemoved,
    emptiesRemoved,
  };
}

export default function DuplicateLineRemoverAndSorter() {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Options>({
    trim: true,
    dropEmpty: true,
    dedupe: true,
    ignoreCase: false,
  });
  const [mode, setMode] = useState<SortMode>("alpha-asc");
  const [seed, setSeed] = useState(1);

  const result = useMemo(
    () => (input === "" ? null : clean(input, options, mode, seed)),
    [input, options, mode, seed],
  );

  const output = result ? result.lines.join("\n") : "";

  const toggle = (key: keyof Options) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const checkbox = (key: keyof Options, label: string) => (
    <label className="flex items-center gap-2 text-sm text-tool-text cursor-pointer select-none">
      <input
        type="checkbox"
        checked={options[key]}
        onChange={() => toggle(key)}
        disabled={key === "ignoreCase" && !options.dedupe}
        className="h-4 w-4 accent-tool-accent"
      />
      <span className={key === "ignoreCase" && !options.dedupe ? "text-tool-muted" : ""}>
        {label}
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label="Input"
        placeholder={"one entry per line\nsecond entry\nsecond entry"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        hint="Paste your list. Each line is treated as one entry."
      />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          Cleanup
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {checkbox("trim", "Trim spaces at both ends")}
          {checkbox("dropEmpty", "Drop empty lines")}
          {checkbox("dedupe", "Remove duplicate lines")}
          {checkbox("ignoreCase", "Ignore case when comparing")}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          Sort order
        </label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SortMode)}
          className="w-full bg-tool-surface border border-tool-border px-3 py-2.5 text-tool-text text-sm focus:outline-none focus:ring-2 focus:ring-tool-accent focus:border-tool-accent transition-colors"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "random" && (
          <ToolButton variant="secondary" onClick={() => setSeed((s) => s + 1)}>
            Shuffle again
          </ToolButton>
        )}
        <ToolButton
          variant="ghost"
          onClick={() => setInput("")}
          disabled={input === ""}
        >
          Clear
        </ToolButton>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Lines in" value={result.inputCount} />
            <StatCard label="Lines out" value={result.lines.length} accent />
            <StatCard label="Duplicates removed" value={result.duplicatesRemoved} />
            <StatCard label="Empty lines removed" value={result.emptiesRemoved} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Output
              </span>
              <CopyButton text={output} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all max-h-96 overflow-auto">
              {output === "" ? (
                <span className="text-tool-muted">Nothing left after cleanup.</span>
              ) : (
                output
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
