import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type Unit = "paragraphs" | "sentences" | "words";
const UNITS: Unit[] = ["paragraphs", "sentences", "words"];

const messages = {
  en: {
    unit: "Unit",
    units: { paragraphs: "Paragraphs", sentences: "Sentences", words: "Words" } as Record<Unit, string>,
    howMany: "How many",
    invalid: (max: number) => `Enter a whole number between 1 and ${max}.`,
    opening: "Start with the classic opening line",
    generate: "Generate",
    clear: "Clear",
    words: "Words",
    characters: "Characters",
    paragraphs: "Paragraphs",
    output: "Output",
  },
  ko: {
    unit: "단위",
    units: { paragraphs: "문단", sentences: "문장", words: "단어" } as Record<Unit, string>,
    howMany: "개수",
    invalid: (max: number) => `1에서 ${max} 사이의 정수를 입력하세요.`,
    opening: "전통적인 첫 문장으로 시작",
    generate: "생성",
    clear: "지우기",
    words: "단어",
    characters: "글자",
    paragraphs: "문단",
    output: "결과",
  },
};

const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui",
  "officia", "deserunt", "mollit", "anim", "id", "est", "laborum", "perspiciatis",
  "unde", "omnis", "iste", "natus", "error", "voluptatem", "accusantium",
  "doloremque", "laudantium", "totam", "rem", "aperiam", "eaque", "ipsa", "quae",
  "ab", "illo", "inventore", "veritatis", "quasi", "architecto", "beatae", "vitae",
  "dicta", "explicabo", "nemo", "aspernatur", "odit", "fugit", "consequuntur",
  "magni", "dolores", "eos", "ratione", "sequi", "nesciunt", "neque", "porro",
  "quisquam", "dolorem", "adipisci", "numquam", "modi", "tempora", "incidunt",
  "magnam", "quaerat", "minima", "nostrum", "corporis", "suscipit", "laboriosam",
  "aliquid", "commodi", "autem", "vel", "eum", "iure", "quam", "nihil",
  "molestiae", "illum", "quo", "voluptas", "harum", "quidem", "rerum", "facilis",
  "expedita", "distinctio", "nam", "libero", "cumque", "impedit", "placeat",
  "facere", "possimus", "assumenda", "repellendus", "temporibus", "quibusdam",
  "officiis", "debitis", "necessitatibus", "saepe", "eveniet", "voluptates",
  "repudiandae", "recusandae", "itaque", "earum", "hic", "tenetur", "sapiente",
  "delectus", "reiciendis", "maiores", "alias", "perferendis", "doloribus",
  "asperiores", "repellat",
];

const OPENING = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const OPENING_WORDS = ["lorem", "ipsum", "dolor", "sit", "amet"];
const MAX_COUNT = 200;

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const repeat = <T,>(n: number, fn: () => T): T[] => Array.from({ length: n }, fn);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const makeWords = (n: number) => repeat(n, () => WORDS[randomInt(0, WORDS.length - 1)]);

function makeSentence(): string {
  const words = makeWords(randomInt(8, 17));
  if (Math.random() < 0.5) {
    const at = randomInt(3, words.length - 3);
    words[at] += ",";
  }
  return `${capitalize(words.join(" "))}.`;
}

const makeParagraph = () => repeat(randomInt(3, 6), makeSentence).join(" ");

function generate(unit: Unit, count: number, opening: boolean): string {
  if (unit === "words") {
    const words = makeWords(count);
    if (opening) OPENING_WORDS.slice(0, count).forEach((w, i) => (words[i] = w));
    return `${capitalize(words.join(" "))}.`;
  }
  if (unit === "sentences") {
    const sentences = repeat(count, makeSentence);
    if (opening) sentences[0] = OPENING;
    return sentences.join(" ");
  }
  const paragraphs = repeat(count, makeParagraph);
  if (opening) paragraphs[0] = `${OPENING} ${paragraphs[0]}`;
  return paragraphs.join("\n\n");
}

export default function LoremIpsumGenerator() {
  const m = useMessages(messages);
  const [unit, setUnit] = useState<Unit>("paragraphs");
  const [count, setCount] = useState("3");
  const [opening, setOpening] = useState(true);
  const [output, setOutput] = useState("");

  const parsed = Number.parseInt(count, 10);
  const valid = parsed >= 1 && parsed <= MAX_COUNT;
  const wordCount = output === "" ? 0 : output.trim().split(/\s+/).length;
  const paragraphCount = output === "" ? 0 : output.split("\n\n").length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">{m.unit}</span>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((id) => (
            <ToolButton key={id} size="sm" variant={unit === id ? "primary" : "secondary"} onClick={() => setUnit(id)}>
              {m.units[id]}
            </ToolButton>
          ))}
        </div>
      </div>

      <ToolInput
        label={m.howMany}
        type="number"
        min={1}
        max={MAX_COUNT}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        hint={valid ? undefined : m.invalid(MAX_COUNT)}
      />

      <label className="flex items-center gap-2 text-sm text-tool-text">
        <input
          type="checkbox"
          checked={opening}
          onChange={(e) => setOpening(e.target.checked)}
          className="h-4 w-4 accent-tool-accent"
        />
        {m.opening}
      </label>

      <div className="flex gap-2">
        <ToolButton onClick={() => setOutput(generate(unit, parsed, opening))} disabled={!valid}>
          {m.generate}
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setOutput("")} disabled={output === ""}>
          {m.clear}
        </ToolButton>
      </div>

      {output && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={m.words} value={wordCount} />
            <StatCard label={m.characters} value={output.length} />
            <StatCard label={m.paragraphs} value={paragraphCount} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.output}</span>
              <CopyButton text={output} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text whitespace-pre-wrap">
              {output}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
