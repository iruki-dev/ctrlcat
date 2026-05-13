import { useState, useMemo } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

function analyze(text: string) {
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  const lines = text === "" ? 0 : text.split("\n").length;
  const sentences = trimmed === "" ? 0 : (trimmed.match(/[.!?]+/g) ?? []).length;
  const paragraphs = trimmed === "" ? 0 : trimmed.split(/\n\s*\n/).filter(Boolean).length;
  const readingTime = Math.ceil(words / 238); // avg 238 wpm
  const speakingTime = Math.ceil(words / 150); // avg 150 wpm

  return {
    words,
    chars,
    charsNoSpace,
    lines,
    sentences,
    paragraphs,
    readingTime,
    speakingTime,
  };
}

export default function WordCounter() {
  const [text, setText] = useState("");
  const stats = useMemo(() => analyze(text), [text]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Input */}
      <ToolTextarea
        label="Your text"
        placeholder="Paste or type your text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <CopyButton text={text} />
        <ToolButton
          variant="ghost"
          size="sm"
          onClick={() => setText("")}
          disabled={text === ""}
        >
          Clear
        </ToolButton>
        <span className="ml-auto text-xs text-tool-muted">
          {stats.words.toLocaleString()} words
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Words" value={stats.words.toLocaleString()} accent />
        <StatCard label="Characters" value={stats.chars.toLocaleString()} />
        <StatCard label="No spaces" value={stats.charsNoSpace.toLocaleString()} />
        <StatCard label="Lines" value={stats.lines.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Sentences" value={stats.sentences.toLocaleString()} />
        <StatCard label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
        <StatCard
          label="Read time"
          value={`${stats.readingTime} min`}
          sub="@ 238 wpm"
        />
        <StatCard
          label="Speak time"
          value={`${stats.speakingTime} min`}
          sub="@ 150 wpm"
        />
      </div>

      {/* Top words */}
      {stats.words > 0 && <TopWords text={text} />}
    </div>
  );
}

function TopWords({ text }: { text: string }) {
  const topWords = useMemo(() => {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
      "for", "of", "with", "by", "from", "is", "it", "this", "that",
      "was", "are", "be", "as", "i", "you", "he", "she", "we", "they",
      "have", "had", "has", "not", "do", "did", "will", "would", "can",
      "could", "should", "may", "might", "shall", "its", "my", "your",
    ]);
    const freq: Record<string, number> = {};
    const words = text.toLowerCase().match(/\b[a-z']{2,}\b/g) ?? [];
    for (const w of words) {
      if (!stopWords.has(w)) freq[w] = (freq[w] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [text]);

  if (topWords.length === 0) return null;

  const maxCount = topWords[0][1];

  return (
    <div className="rounded-xl border border-tool-border bg-tool-surface p-5">
      <h3 className="text-xs font-medium text-tool-muted uppercase tracking-wider mb-4">
        Top words
      </h3>
      <div className="flex flex-col gap-2">
        {topWords.map(([word, count]) => (
          <div key={word} className="flex items-center gap-3">
            <span className="text-sm text-tool-text font-mono w-28 truncate">{word}</span>
            <div className="flex-1 bg-tool-bg rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-tool-accent rounded-full transition-all duration-500"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-tool-muted w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
