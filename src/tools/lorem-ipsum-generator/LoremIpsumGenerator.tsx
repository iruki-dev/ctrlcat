import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Unit = "paragraphs" | "sentences" | "words";

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
const MAX_COUNT = 200;

function pick(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function makeWords(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) out.push(pick());
  return out;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function makeSentence(): string {
  const length = 8 + Math.floor(Math.random() * 10);
  const words = makeWords(length);
  if (words.length > 6 && Math.random() < 0.5) {
    const at = 3 + Math.floor(Math.random() * (words.length - 5));
    words[at] = `${words[at]},`;
  }
  return `${capitalize(words.join(" "))}.`;
}

function makeParagraph(): string {
  const count = 3 + Math.floor(Math.random() * 4);
  const sentences: string[] = [];
  for (let i = 0; i < count; i += 1) sentences.push(makeSentence());
  return sentences.join(" ");
}

function generate(unit: Unit, count: number, opening: boolean): string {
  if (unit === "words") {
    const words = makeWords(count);
    if (opening) {
      const lead = ["lorem", "ipsum", "dolor", "sit", "amet"];
      for (let i = 0; i < Math.min(lead.length, words.length); i += 1) {
        words[i] = lead[i];
      }
    }
    return `${capitalize(words.join(" "))}.`;
  }

  if (unit === "sentences") {
    const sentences: string[] = [];
    for (let i = 0; i < count; i += 1) sentences.push(makeSentence());
    if (opening && sentences.length > 0) sentences[0] = OPENING;
    return sentences.join(" ");
  }

  const paragraphs: string[] = [];
  for (let i = 0; i < count; i += 1) paragraphs.push(makeParagraph());
  if (opening && paragraphs.length > 0) {
    paragraphs[0] = `${OPENING} ${paragraphs[0]}`;
  }
  return paragraphs.join("\n\n");
}

const UNITS: { id: Unit; label: string }[] = [
  { id: "paragraphs", label: "Paragraphs" },
  { id: "sentences", label: "Sentences" },
  { id: "words", label: "Words" },
];

export default function LoremIpsumGenerator() {
  const [unit, setUnit] = useState<Unit>("paragraphs");
  const [count, setCount] = useState("3");
  const [opening, setOpening] = useState(true);
  const [output, setOutput] = useState("");

  const parsed = Number.parseInt(count, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_COUNT;

  const run = () => {
    if (!valid) return;
    setOutput(generate(unit, parsed, opening));
  };

  const wordCount = output === "" ? 0 : output.trim().split(/\s+/).length;
  const paragraphCount = output === "" ? 0 : output.split("\n\n").length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          Unit
        </span>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((item) => (
            <ToolButton
              key={item.id}
              size="sm"
              variant={unit === item.id ? "primary" : "secondary"}
              onClick={() => setUnit(item.id)}
            >
              {item.label}
            </ToolButton>
          ))}
        </div>
      </div>

      <ToolInput
        label="How many"
        type="number"
        min={1}
        max={MAX_COUNT}
        value={count}
        onChange={(e) => setCount(e.target.value)}
      />
      {!valid && (
        <span className="-mt-4 text-xs text-tool-muted">
          Enter a whole number between 1 and {MAX_COUNT}.
        </span>
      )}

      <label className="flex items-center gap-2 text-sm text-tool-text">
        <input
          type="checkbox"
          checked={opening}
          onChange={(e) => setOpening(e.target.checked)}
          className="h-4 w-4 accent-tool-accent"
        />
        Start with the classic opening line
      </label>

      <div className="flex gap-2">
        <ToolButton onClick={run} disabled={!valid}>
          Generate
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setOutput("")}>
          Clear
        </ToolButton>
      </div>

      {output && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Words" value={wordCount} />
            <StatCard label="Characters" value={output.length} />
            <StatCard label="Paragraphs" value={paragraphCount} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Output
              </span>
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
