import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type Mode = "of" | "share" | "change" | "adjust";
const MODES: Mode[] = ["of", "share", "change", "adjust"];
const SUFFIX: Record<Mode, { a?: string; b?: string }> = { of: { a: "%" }, share: {}, change: {}, adjust: { b: "%" } };

const messages = {
  en: {
    modes: {
      of: { label: "Percent of", question: "What is A percent of B?", a: "Percent (A)", b: "Of value (B)" },
      share: { label: "Is what percent", question: "A is what percent of B?", a: "Value (A)", b: "Total (B)" },
      change: { label: "Change", question: "What is the change from A to B?", a: "From (A)", b: "To (B)" },
      adjust: { label: "Increase / decrease", question: "What is A changed by B percent?", a: "Value (A)", b: "Change (B)" },
    } as Record<Mode, { label: string; question: string; a: string; b: string }>,
    clear: "Clear",
    result: "Result",
    percentOf: (a: string, b: string) => `${a}% of ${b}`,
    remainder: "Remainder",
    asFraction: "As a fraction",
    outOf: (a: string, b: string) => `${a} out of ${b}`,
    remainingShare: "Remaining share",
    difference: "Difference",
    zeroTotal: "A total of zero has no parts, so the share cannot be calculated.",
    zeroStart: "Percentage change needs a non-zero starting value.",
    increase: "Increase",
    decrease: "Decrease",
    noChange: "No change",
    absoluteDifference: "Absolute difference",
    multiplier: "Multiplier",
    adjusted: (a: string, up: boolean, pct: string) => `${a} ${up ? "increased" : "decreased"} by ${pct}%`,
    amountOfChange: "Amount of change",
    startingValue: "Starting value",
  },
  ko: {
    modes: {
      of: { label: "퍼센트 값", question: "B의 A%는 얼마인가요?", a: "퍼센트 (A)", b: "기준 값 (B)" },
      share: { label: "몇 퍼센트인가", question: "A는 B의 몇 퍼센트인가요?", a: "값 (A)", b: "전체 (B)" },
      change: { label: "변화율", question: "A에서 B로 얼마나 변했나요?", a: "처음 (A)", b: "나중 (B)" },
      adjust: { label: "증가 / 감소", question: "A를 B% 바꾸면 얼마인가요?", a: "값 (A)", b: "변화 (B)" },
    } as Record<Mode, { label: string; question: string; a: string; b: string }>,
    clear: "지우기",
    result: "결과",
    percentOf: (a: string, b: string) => `${b}의 ${a}%`,
    remainder: "나머지",
    asFraction: "분수로",
    outOf: (a: string, b: string) => `${b} 중 ${a}`,
    remainingShare: "나머지 비율",
    difference: "차이",
    zeroTotal: "전체가 0이면 비율을 계산할 수 없습니다.",
    zeroStart: "변화율을 구하려면 처음 값이 0이 아니어야 합니다.",
    increase: "증가",
    decrease: "감소",
    noChange: "변화 없음",
    absoluteDifference: "절대 차이",
    multiplier: "배수",
    adjusted: (a: string, up: boolean, pct: string) => `${a}에서 ${pct}% ${up ? "증가" : "감소"}`,
    amountOfChange: "변화량",
    startingValue: "처음 값",
  },
};

function round(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

function parse(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface Outcome {
  headlineLabel: string;
  headline: string;
  details: { label: string; value: string }[];
}

export default function PercentageCalculator() {
  const m = useMessages(messages);
  const [mode, setMode] = useState<Mode>("of");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const numA = parse(a);
  const numB = parse(b);

  let outcome: Outcome | null = null;
  let note = "";

  if (numA !== null && numB !== null) {
    if (mode === "of") {
      const result = (numA / 100) * numB;
      outcome = {
        headlineLabel: m.percentOf(round(numA), round(numB)),
        headline: round(result),
        details: [
          { label: m.remainder, value: round(numB - result) },
          { label: m.asFraction, value: `${round(numA / 100)} × ${round(numB)}` },
        ],
      };
    } else if (mode === "share") {
      if (numB === 0) {
        note = m.zeroTotal;
      } else {
        const pct = (numA / numB) * 100;
        outcome = {
          headlineLabel: m.outOf(round(numA), round(numB)),
          headline: `${round(pct)}%`,
          details: [
            { label: m.remainingShare, value: `${round(100 - pct)}%` },
            { label: m.difference, value: round(numB - numA) },
          ],
        };
      }
    } else if (mode === "change") {
      if (numA === 0) {
        note = m.zeroStart;
      } else {
        const diff = numB - numA;
        outcome = {
          headlineLabel: diff < 0 ? m.decrease : diff > 0 ? m.increase : m.noChange,
          headline: `${diff > 0 ? "+" : ""}${round((diff / Math.abs(numA)) * 100)}%`,
          details: [
            { label: m.absoluteDifference, value: round(diff) },
            { label: m.multiplier, value: `×${round(numB / numA)}` },
          ],
        };
      }
    } else {
      const delta = (numA * numB) / 100;
      outcome = {
        headlineLabel: m.adjusted(round(numA), numB >= 0, round(Math.abs(numB))),
        headline: round(numA + delta),
        details: [
          { label: m.amountOfChange, value: round(delta) },
          { label: m.startingValue, value: round(numA) },
        ],
      };
    }
  }

  const copy = m.modes[mode];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {MODES.map((id) => (
          <ToolButton
            key={id}
            size="sm"
            variant={id === mode ? "primary" : "ghost"}
            onClick={() => {
              setMode(id);
              setA("");
              setB("");
            }}
          >
            {m.modes[id].label}
          </ToolButton>
        ))}
      </div>

      <p className="text-sm text-tool-text-dim">{copy.question}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label={copy.a}
          type="number"
          inputMode="decimal"
          placeholder="0"
          suffix={SUFFIX[mode].a}
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <ToolInput
          label={copy.b}
          type="number"
          inputMode="decimal"
          placeholder="0"
          suffix={SUFFIX[mode].b}
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <ToolButton
          variant="ghost"
          onClick={() => {
            setA("");
            setB("");
          }}
          disabled={a === "" && b === ""}
        >
          {m.clear}
        </ToolButton>
      </div>

      {note && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">{note}</div>
      )}

      {outcome && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.result}</span>
            <CopyButton text={`${copy.question} ${outcome.headlineLabel}: ${outcome.headline}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={outcome.headlineLabel} value={outcome.headline} accent />
            {outcome.details.map((d) => (
              <StatCard key={d.label} label={d.label} value={d.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
