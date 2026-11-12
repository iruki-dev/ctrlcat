import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

/** Split an arbitrary string into word tokens, honouring camel/Pascal boundaries. */
function splitWords(value: string): string[] {
  return value
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

function toTitleCase(value: string): string {
  return value.replace(
    /\p{L}[\p{L}\p{N}'’]*/gu,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

function toSentenceCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[.!?]["')\]]?\s+|\n\s*)(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    );
}

interface CaseResult {
  key: string;
  label: string;
  hint: string;
  value: string;
}

function buildResults(value: string): CaseResult[] {
  const words = splitWords(value);
  const lower = words.map((word) => word.toLowerCase());

  return [
    { key: "upper", label: "UPPER CASE", hint: "Every letter capitalised", value: value.toUpperCase() },
    { key: "lower", label: "lower case", hint: "Every letter in lower case", value: value.toLowerCase() },
    { key: "title", label: "Title Case", hint: "First letter of each word", value: toTitleCase(value) },
    { key: "sentence", label: "Sentence case", hint: "First letter of each sentence", value: toSentenceCase(value) },
    {
      key: "camel",
      label: "camelCase",
      hint: "Joined, first word in lower case",
      value: lower.map((word, index) => (index === 0 ? word : capitalize(word))).join(""),
    },
    {
      key: "pascal",
      label: "PascalCase",
      hint: "Joined, every word capitalised",
      value: lower.map(capitalize).join(""),
    },
    { key: "snake", label: "snake_case", hint: "Lower case, underscores", value: lower.join("_") },
    { key: "kebab", label: "kebab-case", hint: "Lower case, hyphens", value: lower.join("-") },
    {
      key: "constant",
      label: "CONSTANT_CASE",
      hint: "Upper case, underscores",
      value: lower.map((word) => word.toUpperCase()).join("_"),
    },
  ];
}

export default function CaseConverter() {
  const [input, setInput] = useState("");

  const results = useMemo(() => buildResults(input), [input]);

  const stats = useMemo(() => {
    const characters = input.length;
    const wordCount = splitWords(input).length;
    const lines = input === "" ? 0 : input.split("\n").length;
    return { characters, wordCount, lines };
  }, [input]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label="Input"
        placeholder="Paste or type any text…"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={6}
        hint="Results update as you type. Everything stays in your browser."
      />

      <div className="flex gap-2">
        <ToolButton variant="ghost" onClick={() => setInput("")} disabled={input === ""}>
          Clear
        </ToolButton>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Characters" value={stats.characters} />
        <StatCard label="Words" value={stats.wordCount} />
        <StatCard label="Lines" value={stats.lines} />
      </div>

      <div className="flex flex-col gap-3">
        {results.map((result) => (
          <div key={result.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                  {result.label}
                </span>
                <span className="text-xs text-tool-muted">{result.hint}</span>
              </div>
              <CopyButton text={result.value} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all min-h-[3.25rem]">
              {result.value === "" ? (
                <span className="text-tool-muted">Waiting for input</span>
              ) : (
                result.value
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
