import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type CaseKey = "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";

const LABELS: Record<CaseKey, string> = {
  upper: "UPPER CASE",
  lower: "lower case",
  title: "Title Case",
  sentence: "Sentence case",
  camel: "camelCase",
  pascal: "PascalCase",
  snake: "snake_case",
  kebab: "kebab-case",
  constant: "CONSTANT_CASE",
};

const messages = {
  en: {
    input: "Input",
    placeholder: "Paste or type any text…",
    inputHint: "Results update as you type. Everything stays in your browser.",
    clear: "Clear",
    characters: "Characters",
    words: "Words",
    lines: "Lines",
    waiting: "Waiting for input",
    hints: {
      upper: "Every letter capitalised",
      lower: "Every letter in lower case",
      title: "First letter of each word",
      sentence: "First letter of each sentence",
      camel: "Joined, first word in lower case",
      pascal: "Joined, every word capitalised",
      snake: "Lower case, underscores",
      kebab: "Lower case, hyphens",
      constant: "Upper case, underscores",
    } as Record<CaseKey, string>,
  },
  ko: {
    input: "입력",
    placeholder: "텍스트를 붙여넣거나 입력하세요…",
    inputHint: "입력하는 대로 결과가 바뀝니다. 모든 처리는 브라우저 안에서만 이루어집니다.",
    clear: "지우기",
    characters: "글자",
    words: "단어",
    lines: "줄",
    waiting: "입력을 기다리는 중",
    hints: {
      upper: "모든 글자를 대문자로",
      lower: "모든 글자를 소문자로",
      title: "각 단어의 첫 글자를 대문자로",
      sentence: "각 문장의 첫 글자를 대문자로",
      camel: "붙여 쓰고 첫 단어만 소문자로",
      pascal: "붙여 쓰고 모든 단어를 대문자로 시작",
      snake: "소문자, 밑줄로 연결",
      kebab: "소문자, 하이픈으로 연결",
      constant: "대문자, 밑줄로 연결",
    } as Record<CaseKey, string>,
  },
};

/** Split into word tokens, honouring camel/Pascal boundaries. */
function splitWords(value: string): string[] {
  return value
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function toTitleCase(value: string): string {
  return value.replace(/\p{L}[\p{L}\p{N}'’]*/gu, (word) => capitalize(word.toLowerCase()));
}

function toSentenceCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[.!?]["')\]]?\s+|\n\s*)(\p{L})/gu, (_m, lead: string, letter: string) => lead + letter.toUpperCase());
}

function convert(value: string): Record<CaseKey, string> {
  const lower = splitWords(value).map((word) => word.toLowerCase());
  return {
    upper: value.toUpperCase(),
    lower: value.toLowerCase(),
    title: toTitleCase(value),
    sentence: toSentenceCase(value),
    camel: lower.map((word, i) => (i === 0 ? word : capitalize(word))).join(""),
    pascal: lower.map(capitalize).join(""),
    snake: lower.join("_"),
    kebab: lower.join("-"),
    constant: lower.join("_").toUpperCase(),
  };
}

export default function CaseConverter() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const results = useMemo(() => convert(input), [input]);
  const wordCount = useMemo(() => splitWords(input).length, [input]);
  const lines = input === "" ? 0 : input.split("\n").length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label={m.input}
        placeholder={m.placeholder}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        rows={6}
        hint={m.inputHint}
      />

      <div className="flex gap-2">
        <ToolButton variant="ghost" onClick={() => setInput("")} disabled={input === ""}>
          {m.clear}
        </ToolButton>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={m.characters} value={input.length} />
        <StatCard label={m.words} value={wordCount} />
        <StatCard label={m.lines} value={lines} />
      </div>

      <div className="flex flex-col gap-3">
        {(Object.keys(LABELS) as CaseKey[]).map((key) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{LABELS[key]}</span>
                <span className="text-xs text-tool-muted">{m.hints[key]}</span>
              </div>
              <CopyButton text={results[key]} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all min-h-[3.25rem]">
              {results[key] === "" ? <span className="text-tool-muted">{m.waiting}</span> : results[key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
