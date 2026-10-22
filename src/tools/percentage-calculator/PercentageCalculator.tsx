import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Mode = "of" | "share" | "change" | "adjust";

const MODES: { id: Mode; label: string; question: string }[] = [
  { id: "of", label: "Percent of", question: "What is A percent of B?" },
  { id: "share", label: "Is what percent", question: "A is what percent of B?" },
  { id: "change", label: "Change", question: "What is the change from A to B?" },
  { id: "adjust", label: "Increase / decrease", question: "What is A changed by B percent?" },
];

const LABELS: Record<Mode, { a: string; b: string; aSuffix?: string; bSuffix?: string }> = {
  of: { a: "Percent (A)", b: "Of value (B)", aSuffix: "%" },
  share: { a: "Value (A)", b: "Total (B)" },
  change: { a: "From (A)", b: "To (B)" },
  adjust: { a: "Value (A)", b: "Change (B)", bSuffix: "%" },
};

function round(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function parse(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export default function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>("of");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const numA = parse(a);
  const numB = parse(b);
  const ready = numA !== null && numB !== null;

  let headline = "—";
  let headlineLabel = "Result";
  let details: { label: string; value: string }[] = [];
  let note = "";

  if (ready) {
    if (mode === "of") {
      const result = (numA / 100) * numB;
      headlineLabel = `${round(numA)}% of ${round(numB)}`;
      headline = round(result);
      details = [
        { label: "Remainder", value: round(numB - result) },
        { label: "As a fraction", value: `${round(numA / 100)} × ${round(numB)}` },
      ];
    } else if (mode === "share") {
      if (numB === 0) {
        note = "A total of zero has no parts, so the share cannot be calculated.";
      } else {
        const pct = (numA / numB) * 100;
        headlineLabel = `${round(numA)} out of ${round(numB)}`;
        headline = `${round(pct)}%`;
        details = [
          { label: "Remaining share", value: `${round(100 - pct)}%` },
          { label: "Difference", value: round(numB - numA) },
        ];
      }
    } else if (mode === "change") {
      if (numA === 0) {
        note = "Percentage change needs a non-zero starting value.";
      } else {
        const diff = numB - numA;
        const pct = (diff / Math.abs(numA)) * 100;
        headlineLabel = diff < 0 ? "Decrease" : diff > 0 ? "Increase" : "No change";
        headline = `${diff > 0 ? "+" : ""}${round(pct)}%`;
        details = [
          { label: "Absolute difference", value: round(diff) },
          { label: "Multiplier", value: `×${round(numB / numA)}` },
        ];
      }
    } else {
      const delta = (numA * numB) / 100;
      headlineLabel = `${round(numA)} ${numB < 0 ? "decreased" : "increased"} by ${round(Math.abs(numB))}%`;
      headline = round(numA + delta);
      details = [
        { label: "Amount of change", value: round(delta) },
        { label: "Starting value", value: round(numA) },
      ];
    }
  }

  const hasResult = ready && note === "";
  const labels = LABELS[mode];
  const activeMode = MODES.find((m) => m.id === mode)!;

  const copyText = hasResult
    ? `${activeMode.question} ${headlineLabel}: ${headline}`
    : "";

  const switchMode = (next: Mode) => {
    setMode(next);
    setA("");
    setB("");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <ToolButton
            key={m.id}
            size="sm"
            variant={m.id === mode ? "primary" : "ghost"}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </ToolButton>
        ))}
      </div>

      <p className="text-sm text-tool-text-dim">{activeMode.question}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label={labels.a}
          type="number"
          inputMode="decimal"
          placeholder="0"
          suffix={labels.aSuffix}
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <ToolInput
          label={labels.b}
          type="number"
          inputMode="decimal"
          placeholder="0"
          suffix={labels.bSuffix}
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
          Clear
        </ToolButton>
      </div>

      {note !== "" && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
          {note}
        </div>
      )}

      {hasResult && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Result
            </span>
            <CopyButton text={copyText} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={headlineLabel} value={headline} accent />
            {details.map((d) => (
              <StatCard key={d.label} label={d.label} value={d.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
