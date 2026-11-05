import { useEffect, useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Unit = "auto" | "s" | "ms" | "us" | "ns";
type FixedUnit = Exclude<Unit, "auto">;

const UNITS: Unit[] = ["auto", "s", "ms", "us", "ns"];

const UNIT_LABEL: Record<Unit, string> = {
  auto: "Auto",
  s: "Seconds",
  ms: "Milliseconds",
  us: "Microseconds",
  ns: "Nanoseconds",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (value: number, width = 2) =>
  Math.abs(value).toString().padStart(width, "0");

const detectUnit = (value: number): FixedUnit => {
  const size = Math.abs(value);
  if (size < 1e11) return "s";
  if (size < 1e14) return "ms";
  if (size < 1e17) return "us";
  return "ns";
};

const toMillis = (value: number, unit: FixedUnit): number => {
  if (unit === "s") return value * 1000;
  if (unit === "ms") return value;
  if (unit === "us") return value / 1000;
  return value / 1e6;
};

const offsetLabel = (date: Date): string => {
  const total = -date.getTimezoneOffset();
  const sign = total < 0 ? "-" : "+";
  return `${sign}${pad(Math.floor(Math.abs(total) / 60))}:${pad(Math.abs(total) % 60)}`;
};

const utcText = (date: Date): string =>
  `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ` +
  `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:` +
  `${pad(date.getUTCSeconds())} UTC`;

const localText = (date: Date): string =>
  `${DAYS[date.getDay()]}, ${pad(date.getDate())} ${MONTHS[date.getMonth()]} ` +
  `${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:` +
  `${pad(date.getSeconds())} (UTC${offsetLabel(date)})`;

const isoLocalText = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
  offsetLabel(date);

const relativeText = (target: number, now: number): string => {
  const diff = target - now;
  const size = Math.abs(diff);
  const steps: Array<[number, string]> = [
    [1000, "second"],
    [60 * 1000, "minute"],
    [3600 * 1000, "hour"],
    [86400 * 1000, "day"],
    [30 * 86400 * 1000, "month"],
    [365 * 86400 * 1000, "year"],
  ];
  if (size < 1000) return "right now";
  let unitMs = 1000;
  let name = "second";
  for (const [step, label] of steps) {
    if (size >= step) {
      unitMs = step;
      name = label;
    }
  }
  const count = Math.floor(size / unitMs);
  const plural = count === 1 ? name : `${name}s`;
  return diff < 0 ? `${count} ${plural} ago` : `in ${count} ${plural}`;
};

const dayOfYear = (date: Date): number => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.round((current - start) / 86400000) + 1;
};

const parseTimestamp = (raw: string): number | null => {
  const text = raw.trim().replace(/[_,\s]/g, "");
  if (text === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const parseDateText = (raw: string): number | null => {
  const text = raw.trim();
  if (text === "") return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)
    ? text.replace(" ", "T")
    : text;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const timeZoneName = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  } catch {
    return "local time";
  }
};

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-tool-border bg-tool-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">
          {label}
        </span>
        <CopyButton text={value} />
      </div>
      <span className="break-all font-mono text-sm text-tool-text">{value}</span>
    </div>
  );
}

export default function TimestampConverter() {
  const [now, setNow] = useState(0);
  const [stampInput, setStampInput] = useState("");
  const [unit, setUnit] = useState<Unit>("auto");
  const [dateInput, setDateInput] = useState("");

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const zone = useMemo(() => timeZoneName(), []);

  const stampResult = useMemo(() => {
    const raw = parseTimestamp(stampInput);
    if (raw === null) {
      return stampInput.trim() === ""
        ? null
        : { error: "That is not a number. Enter digits only, with an optional minus sign." };
    }
    const used: FixedUnit = unit === "auto" ? detectUnit(raw) : unit;
    const millis = toMillis(raw, used);
    if (!Number.isFinite(millis) || Math.abs(millis) > 8.64e15) {
      return { error: "That value is outside the range of dates this tool can show." };
    }
    const date = new Date(Math.round(millis));
    if (Number.isNaN(date.getTime())) {
      return { error: "That value is outside the range of dates this tool can show." };
    }
    return {
      used,
      date,
      millis: Math.round(millis),
      seconds: Math.floor(millis / 1000),
    };
  }, [stampInput, unit]);

  const dateResult = useMemo(() => {
    const millis = parseDateText(dateInput);
    if (millis === null) {
      return dateInput.trim() === ""
        ? null
        : { error: "That text could not be read as a date. Try a form like 2026-11-05T09:30:00." };
    }
    return { millis, date: new Date(millis) };
  }, [dateInput]);

  const nowDate = now === 0 ? null : new Date(now);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">
            Current time
          </span>
          <span className="text-xs text-tool-text-dim">{zone}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Unix seconds"
            value={nowDate ? Math.floor(now / 1000).toString() : "—"}
            accent
          />
          <StatCard
            label="Unix milliseconds"
            value={nowDate ? now.toString() : "—"}
          />
          <StatCard
            label="Local time"
            value={nowDate ? `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}:${pad(nowDate.getSeconds())}` : "—"}
            sub={nowDate ? `UTC${offsetLabel(nowDate)}` : undefined}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolButton
            size="sm"
            variant="secondary"
            onClick={() => setStampInput(Math.floor(Date.now() / 1000).toString())}
          >
            Fill seconds now
          </ToolButton>
          <ToolButton
            size="sm"
            variant="secondary"
            onClick={() => setStampInput(Date.now().toString())}
          >
            Fill milliseconds now
          </ToolButton>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-tool-text">Timestamp to date</h2>
        <ToolInput
          label="Unix timestamp"
          placeholder="1762300000"
          inputMode="numeric"
          value={stampInput}
          onChange={(event) => setStampInput(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">
            Unit
          </span>
          {UNITS.map((option) => (
            <ToolButton
              key={option}
              size="sm"
              variant={unit === option ? "primary" : "ghost"}
              onClick={() => setUnit(option)}
            >
              {UNIT_LABEL[option]}
            </ToolButton>
          ))}
        </div>

        {stampResult && "error" in stampResult && (
          <p className="text-sm text-tool-text-dim">{stampResult.error}</p>
        )}

        {stampResult && !("error" in stampResult) && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-tool-text-dim">
              Read as {UNIT_LABEL[stampResult.used].toLowerCase()}
              {unit === "auto" ? " (detected)" : ""}
            </p>
            <OutputRow label="UTC" value={utcText(stampResult.date)} />
            <OutputRow label="Local" value={localText(stampResult.date)} />
            <OutputRow label="ISO 8601 (UTC)" value={stampResult.date.toISOString()} />
            <OutputRow label="ISO 8601 (local)" value={isoLocalText(stampResult.date)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Unix seconds" value={stampResult.seconds.toString()} />
              <StatCard label="Unix milliseconds" value={stampResult.millis.toString()} />
              <StatCard
                label="Relative"
                value={nowDate ? relativeText(stampResult.millis, now) : "—"}
                sub={`Day ${dayOfYear(stampResult.date)} of ${stampResult.date.getUTCFullYear()}`}
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-tool-text">Date to timestamp</h2>
        <ToolInput
          label="Date and time"
          hint="ISO form, a plain date, or a date with a space before the time."
          placeholder="2026-11-05T09:30:00"
          value={dateInput}
          onChange={(event) => setDateInput(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <ToolButton
            size="sm"
            variant="secondary"
            onClick={() => setDateInput(isoLocalText(new Date()))}
          >
            Use current time
          </ToolButton>
          <ToolButton
            size="sm"
            variant="ghost"
            onClick={() => {
              setDateInput("");
              setStampInput("");
              setUnit("auto");
            }}
          >
            Clear all
          </ToolButton>
        </div>

        {dateResult && "error" in dateResult && (
          <p className="text-sm text-tool-text-dim">{dateResult.error}</p>
        )}

        {dateResult && !("error" in dateResult) && (
          <div className="flex flex-col gap-3">
            <OutputRow
              label="Unix seconds"
              value={Math.floor(dateResult.millis / 1000).toString()}
            />
            <OutputRow label="Unix milliseconds" value={dateResult.millis.toString()} />
            <OutputRow label="UTC" value={utcText(dateResult.date)} />
            <OutputRow label="ISO 8601 (UTC)" value={dateResult.date.toISOString()} />
          </div>
        )}
      </section>
    </div>
  );
}
