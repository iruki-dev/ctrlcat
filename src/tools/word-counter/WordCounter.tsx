import { useState, useMemo } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

const READ_WPM = 238;
const SPEAK_WPM = 150;

const messages = {
  en: {
    label: "Your text",
    placeholder: "Paste or type your text here…",
    clear: "Clear",
    wordCount: (n: string) => `${n} words`,
    words: "Words",
    characters: "Characters",
    noSpaces: "No spaces",
    lines: "Lines",
    sentences: "Sentences",
    paragraphs: "Paragraphs",
    readTime: "Read time",
    speakTime: "Speak time",
    minutes: (n: number) => `${n} min`,
    wpm: (n: number) => `@ ${n} wpm`,
    topWords: "Top words",
  },
  ko: {
    label: "텍스트",
    placeholder: "텍스트를 붙여넣거나 입력하세요…",
    clear: "지우기",
    wordCount: (n: string) => `${n}단어`,
    words: "단어",
    characters: "글자",
    noSpaces: "공백 제외",
    lines: "줄",
    sentences: "문장",
    paragraphs: "문단",
    readTime: "읽는 시간",
    speakTime: "말하는 시간",
    minutes: (n: number) => `${n}분`,
    wpm: (n: number) => `분당 ${n}단어 기준`,
    topWords: "자주 쓴 단어",
  },
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
  "for", "of", "with", "by", "from", "is", "it", "this", "that",
  "was", "are", "be", "as", "i", "you", "he", "she", "we", "they",
  "have", "had", "has", "not", "do", "did", "will", "would", "can",
  "could", "should", "may", "might", "shall", "its", "my", "your",
]);

function analyze(text: string) {
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  return {
    words,
    chars: text.length,
    charsNoSpace: text.replace(/\s/g, "").length,
    lines: text === "" ? 0 : text.split("\n").length,
    sentences: trimmed === "" ? 0 : (trimmed.match(/[.!?。]+/g) ?? []).length,
    paragraphs: trimmed === "" ? 0 : trimmed.split(/\n\s*\n/).filter(Boolean).length,
    readingTime: Math.ceil(words / READ_WPM),
    speakingTime: Math.ceil(words / SPEAK_WPM),
  };
}

function topWords(text: string) {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[\p{L}\p{N}']{2,}/gu) ?? []) {
    if (!STOP_WORDS.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq].sort(([, a], [, b]) => b - a).slice(0, 8);
}

export default function WordCounter() {
  const m = useMessages(messages);
  const [text, setText] = useState("");
  const stats = useMemo(() => analyze(text), [text]);
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label={m.label}
        placeholder={m.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <CopyButton text={text} />
        <ToolButton variant="ghost" size="sm" onClick={() => setText("")} disabled={text === ""}>
          {m.clear}
        </ToolButton>
        <span className="ml-auto text-xs text-tool-muted">{m.wordCount(fmt(stats.words))}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={m.words} value={fmt(stats.words)} accent />
        <StatCard label={m.characters} value={fmt(stats.chars)} />
        <StatCard label={m.noSpaces} value={fmt(stats.charsNoSpace)} />
        <StatCard label={m.lines} value={fmt(stats.lines)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={m.sentences} value={fmt(stats.sentences)} />
        <StatCard label={m.paragraphs} value={fmt(stats.paragraphs)} />
        <StatCard label={m.readTime} value={m.minutes(stats.readingTime)} sub={m.wpm(READ_WPM)} />
        <StatCard label={m.speakTime} value={m.minutes(stats.speakingTime)} sub={m.wpm(SPEAK_WPM)} />
      </div>

      {stats.words > 0 && <TopWords text={text} title={m.topWords} />}
    </div>
  );
}

function TopWords({ text, title }: { text: string; title: string }) {
  const words = useMemo(() => topWords(text), [text]);
  if (words.length === 0) return null;
  const maxCount = words[0][1];

  return (
    <div className="rounded-xl border border-tool-border bg-tool-surface p-5">
      <h3 className="text-xs font-medium text-tool-muted uppercase tracking-wider mb-4">{title}</h3>
      <div className="flex flex-col gap-2">
        {words.map(([word, count]) => (
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
