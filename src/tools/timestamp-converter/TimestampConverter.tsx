import { useEffect, useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useLang, useMessages } from "../../i18n/react";

type Unit = "auto" | "s" | "ms" | "us" | "ns";
type FixedUnit = Exclude<Unit, "auto">;
const UNITS: Unit[] = ["auto", "s", "ms", "us", "ns"];
const MAX_MILLIS = 8.64e15;

const messages = {
  en: {
    units: { auto: "Auto", s: "Seconds", ms: "Milliseconds", us: "Microseconds", ns: "Nanoseconds" } as Record<Unit, string>,
    currentTime: "Current time",
    localTimeZone: "local time",
    unixSeconds: "Unix seconds",
    unixMillis: "Unix milliseconds",
    localTime: "Local time",
    fillSeconds: "Fill seconds now",
    fillMillis: "Fill milliseconds now",
    toDate: "Timestamp to date",
    timestamp: "Unix timestamp",
    unit: "Unit",
    notNumber: "That is not a number. Enter digits only, with an optional minus sign.",
    outOfRange: "That value is outside the range of dates this tool can show.",
    readAs: (unit: string, detected: boolean) => `Read as ${unit.toLowerCase()}${detected ? " (detected)" : ""}`,
    local: "Local",
    relative: "Relative",
    dayOfYear: (day: number, year: number) => `Day ${day} of ${year}`,
    toStamp: "Date to timestamp",
    dateTime: "Date and time",
    dateHint: "ISO form, a plain date, or a date with a space before the time.",
    notDate: "That text could not be read as a date. Try a form like 2026-11-05T09:30:00.",
    useNow: "Use current time",
    clearAll: "Clear all",
  },
  ko: {
    units: { auto: "자동", s: "초", ms: "밀리초", us: "마이크로초", ns: "나노초" } as Record<Unit, string>,
    currentTime: "현재 시각",
    localTimeZone: "현지 시간",
    unixSeconds: "유닉스 초",
    unixMillis: "유닉스 밀리초",
    localTime: "현지 시각",
    fillSeconds: "지금 시각(초) 넣기",
    fillMillis: "지금 시각(밀리초) 넣기",
    toDate: "타임스탬프 → 날짜",
    timestamp: "유닉스 타임스탬프",
    unit: "단위",
    notNumber: "숫자가 아닙니다. 숫자만 입력하세요. 앞에 마이너스 기호는 쓸 수 있습니다.",
    outOfRange: "이 도구로 표시할 수 있는 날짜 범위를 벗어났습니다.",
    readAs: (unit: string, detected: boolean) => `${unit} 단위로 해석${detected ? " (자동 감지)" : ""}`,
    local: "현지",
    relative: "상대 시간",
    dayOfYear: (day: number, year: number) => `${year}년의 ${day}번째 날`,
    toStamp: "날짜 → 타임스탬프",
    dateTime: "날짜와 시간",
    dateHint: "ISO 형식, 날짜만, 또는 날짜와 시간 사이에 공백을 둔 형식을 쓸 수 있습니다.",
    notDate: "날짜로 읽을 수 없습니다. 2026-11-05T09:30:00 같은 형식으로 입력해 보세요.",
    useNow: "현재 시각 사용",
    clearAll: "모두 지우기",
  },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value: number) => Math.abs(value).toString().padStart(2, "0");

const detectUnit = (value: number): FixedUnit => {
  const size = Math.abs(value);
  if (size < 1e11) return "s";
  if (size < 1e14) return "ms";
  if (size < 1e17) return "us";
  return "ns";
};

const MILLIS_PER: Record<FixedUnit, number> = { s: 1000, ms: 1, us: 1e-3, ns: 1e-6 };

const offsetLabel = (date: Date): string => {
  const total = -date.getTimezoneOffset();
  return `${total < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(total) / 60))}:${pad(Math.abs(total) % 60)}`;
};

/** RFC 2822-style text; kept in English on purpose since it is a wire format. */
const dateText = (d: Date, utc: boolean): string => {
  const [day, date, month, year, h, min, s] = utc
    ? [d.getUTCDay(), d.getUTCDate(), d.getUTCMonth(), d.getUTCFullYear(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    : [d.getDay(), d.getDate(), d.getMonth(), d.getFullYear(), d.getHours(), d.getMinutes(), d.getSeconds()];
  const zone = utc ? "UTC" : `(UTC${offsetLabel(d)})`;
  return `${DAYS[day]}, ${pad(date)} ${MONTHS[month]} ${year} ${pad(h)}:${pad(min)}:${pad(s)} ${zone}`;
};

const isoLocalText = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
  offsetLabel(d);

const RELATIVE_STEPS: [number, Intl.RelativeTimeFormatUnit][] = [
  [365 * 86400e3, "year"],
  [30 * 86400e3, "month"],
  [86400e3, "day"],
  [3600e3, "hour"],
  [60e3, "minute"],
  [1e3, "second"],
];

function relativeText(target: number, now: number, lang: string): string {
  const diff = target - now;
  const fmt = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const [step, unit] = RELATIVE_STEPS.find(([ms]) => Math.abs(diff) >= ms) ?? [1e3, "second"];
  return fmt.format(Math.trunc(diff / step), unit);
}

const dayOfYear = (d: Date): number =>
  Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;

function parseTimestamp(raw: string): number | null {
  const text = raw.trim().replace(/[_,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

function parseDateText(raw: string): number | null {
  const text = raw.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? text.replace(" ", "T") : text;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-tool-border bg-tool-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">{label}</span>
        <CopyButton text={value} />
      </div>
      <span className="break-all font-mono text-sm text-tool-text">{value}</span>
    </div>
  );
}

export default function TimestampConverter() {
  const m = useMessages(messages);
  const lang = useLang();
  const [now, setNow] = useState<number | null>(null);
  const [stampInput, setStampInput] = useState("");
  const [unit, setUnit] = useState<Unit>("auto");
  const [dateInput, setDateInput] = useState("");

  // Start the clock after mount so the static HTML does not bake in the build time.
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const zone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || m.localTimeZone, [m]);

  const stampResult = useMemo(() => {
    if (stampInput.trim() === "") return null;
    const raw = parseTimestamp(stampInput);
    if (raw === null) return { error: m.notNumber };
    const used = unit === "auto" ? detectUnit(raw) : unit;
    const millis = Math.round(raw * MILLIS_PER[used]);
    if (!Number.isFinite(millis) || Math.abs(millis) > MAX_MILLIS) return { error: m.outOfRange };
    return { used, millis, date: new Date(millis) };
  }, [stampInput, unit, m]);

  const dateResult = useMemo(() => {
    if (dateInput.trim() === "") return null;
    const millis = parseDateText(dateInput);
    return millis === null ? { error: m.notDate } : { millis, date: new Date(millis) };
  }, [dateInput, m]);

  const nowDate = now === null ? null : new Date(now);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">{m.currentTime}</span>
          <span className="text-xs text-tool-text-dim">{zone}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label={m.unixSeconds} value={now === null ? "—" : Math.floor(now / 1000)} accent />
          <StatCard label={m.unixMillis} value={now ?? "—"} />
          <StatCard
            label={m.localTime}
            value={nowDate ? `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}:${pad(nowDate.getSeconds())}` : "—"}
            sub={nowDate ? `UTC${offsetLabel(nowDate)}` : undefined}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolButton size="sm" variant="secondary" onClick={() => setStampInput(String(Math.floor(Date.now() / 1000)))}>
            {m.fillSeconds}
          </ToolButton>
          <ToolButton size="sm" variant="secondary" onClick={() => setStampInput(String(Date.now()))}>
            {m.fillMillis}
          </ToolButton>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-tool-text">{m.toDate}</h2>
        <ToolInput
          label={m.timestamp}
          placeholder="1762300000"
          inputMode="numeric"
          value={stampInput}
          onChange={(event) => setStampInput(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">{m.unit}</span>
          {UNITS.map((option) => (
            <ToolButton key={option} size="sm" variant={unit === option ? "primary" : "ghost"} onClick={() => setUnit(option)}>
              {m.units[option]}
            </ToolButton>
          ))}
        </div>

        {stampResult && "error" in stampResult && <p className="text-sm text-tool-text-dim">{stampResult.error}</p>}

        {stampResult && !("error" in stampResult) && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-tool-text-dim">{m.readAs(m.units[stampResult.used], unit === "auto")}</p>
            <OutputRow label="UTC" value={dateText(stampResult.date, true)} />
            <OutputRow label={m.local} value={dateText(stampResult.date, false)} />
            <OutputRow label="ISO 8601 (UTC)" value={stampResult.date.toISOString()} />
            <OutputRow label={`ISO 8601 (${m.local})`} value={isoLocalText(stampResult.date)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={m.unixSeconds} value={Math.floor(stampResult.millis / 1000)} />
              <StatCard label={m.unixMillis} value={stampResult.millis} />
              <StatCard
                label={m.relative}
                value={now === null ? "—" : relativeText(stampResult.millis, now, lang)}
                sub={m.dayOfYear(dayOfYear(stampResult.date), stampResult.date.getUTCFullYear())}
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-tool-text">{m.toStamp}</h2>
        <ToolInput
          label={m.dateTime}
          hint={m.dateHint}
          placeholder="2026-11-05T09:30:00"
          value={dateInput}
          onChange={(event) => setDateInput(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <ToolButton size="sm" variant="secondary" onClick={() => setDateInput(isoLocalText(new Date()))}>
            {m.useNow}
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
            {m.clearAll}
          </ToolButton>
        </div>

        {dateResult && "error" in dateResult && <p className="text-sm text-tool-text-dim">{dateResult.error}</p>}

        {dateResult && !("error" in dateResult) && (
          <div className="flex flex-col gap-3">
            <OutputRow label={m.unixSeconds} value={String(Math.floor(dateResult.millis / 1000))} />
            <OutputRow label={m.unixMillis} value={String(dateResult.millis)} />
            <OutputRow label="UTC" value={dateText(dateResult.date, true)} />
            <OutputRow label="ISO 8601 (UTC)" value={dateResult.date.toISOString()} />
          </div>
        )}
      </section>
    </div>
  );
}
