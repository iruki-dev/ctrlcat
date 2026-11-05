import { useEffect, useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Fields = {
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[];
  domRestricted: boolean;
  dowRestricted: boolean;
  monthRestricted: boolean;
  hourRestricted: boolean;
  minuteRestricted: boolean;
  minuteStep: number | null;
  hourStep: number | null;
};

type ParseResult =
  | { ok: true; fields: Fields; normalized: string }
  | { ok: false; error: string };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const PRESETS: { label: string; value: string }[] = [
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Weekdays at 09:00", value: "0 9 * * 1-5" },
  { label: "Every Monday 08:30", value: "30 8 * * MON" },
  { label: "First of the month", value: "0 0 1 * *" },
];

function parseField(
  raw: string,
  min: number,
  max: number,
  aliases: Record<string, number> | null,
  label: string,
): { values: number[]; restricted: boolean; step: number | null } {
  const text = raw.trim();
  if (text === "") throw new Error(`The ${label} field is empty.`);

  const normalized = text === "?" ? "*" : text;
  const found = new Set<number>();
  let restricted = true;
  let step: number | null = null;

  for (const part of normalized.split(",")) {
    const piece = part.trim();
    if (piece === "") throw new Error(`The ${label} field has an empty item.`);

    let rangeText = piece;
    let stepValue = 1;

    const slash = piece.indexOf("/");
    if (slash !== -1) {
      rangeText = piece.slice(0, slash).trim();
      const stepText = piece.slice(slash + 1).trim();
      if (!/^\d+$/.test(stepText)) {
        throw new Error(`The ${label} field has an invalid step "${stepText}".`);
      }
      stepValue = Number(stepText);
      if (stepValue < 1) {
        throw new Error(`The ${label} step must be 1 or more.`);
      }
    }

    let from: number;
    let to: number;

    if (rangeText === "*") {
      from = min;
      to = max;
      if (stepValue === 1) restricted = false;
      else step = stepValue;
    } else {
      const dash = rangeText.indexOf("-", 1);
      if (dash !== -1) {
        from = readValue(rangeText.slice(0, dash), min, max, aliases, label);
        to = readValue(rangeText.slice(dash + 1), min, max, aliases, label);
      } else {
        from = readValue(rangeText, min, max, aliases, label);
        to = slash !== -1 ? max : from;
      }
    }

    if (from > to) {
      for (let v = from; v <= max; v += stepValue) found.add(v);
      for (let v = min; v <= to; v += stepValue) found.add(v);
    } else {
      for (let v = from; v <= to; v += stepValue) found.add(v);
    }
  }

  const values = Array.from(found).sort((a, b) => a - b);
  if (values.length === 0) {
    throw new Error(`The ${label} field does not match any value.`);
  }
  return { values, restricted, step };
}

function readValue(
  raw: string,
  min: number,
  max: number,
  aliases: Record<string, number> | null,
  label: string,
): number {
  const text = raw.trim();
  if (text === "") throw new Error(`The ${label} field is missing a value.`);

  let value: number;
  if (/^\d+$/.test(text)) {
    value = Number(text);
  } else if (aliases && aliases[text.toLowerCase()] !== undefined) {
    value = aliases[text.toLowerCase()];
  } else {
    throw new Error(`"${text}" is not a valid ${label} value.`);
  }

  if (label === "day of week" && value === 7) value = 0;

  if (value < min || value > max) {
    throw new Error(
      `${label} values must be between ${min} and ${max}, but got ${value}.`,
    );
  }
  return value;
}

function parseCron(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Enter a cron expression." };

  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = expanded.split(/\s+/);

  if (parts.length !== 5) {
    return {
      ok: false,
      error: `A cron expression needs 5 fields separated by spaces, but ${parts.length} ${
        parts.length === 1 ? "was" : "were"
      } found.`,
    };
  }

  try {
    const minute = parseField(parts[0], 0, 59, null, "minute");
    const hour = parseField(parts[1], 0, 23, null, "hour");
    const dom = parseField(parts[2], 1, 31, null, "day of month");
    const month = parseField(parts[3], 1, 12, MONTH_ALIASES, "month");
    const dow = parseField(parts[4], 0, 6, DAY_ALIASES, "day of week");

    return {
      ok: true,
      normalized: parts.join(" "),
      fields: {
        minutes: minute.values,
        hours: hour.values,
        doms: dom.values,
        months: month.values,
        dows: dow.values,
        minuteRestricted: minute.restricted,
        hourRestricted: hour.restricted,
        domRestricted: dom.restricted,
        monthRestricted: month.restricted,
        dowRestricted: dow.restricted,
        minuteStep: minute.step,
        hourStep: hour.step,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "That expression could not be read.",
    };
  }
}

function joinList(items: string[], word: string): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${word} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function describeNumbers(values: number[], maxGroups: number): string {
  const groups: string[] = [];
  let start = 0;

  for (let i = 1; i <= values.length; i += 1) {
    const ends = i === values.length || values[i] !== values[i - 1] + 1;
    if (!ends) continue;
    const span = i - start;
    if (span >= 3) groups.push(`${values[start]} to ${values[i - 1]}`);
    else for (let j = start; j < i; j += 1) groups.push(String(values[j]));
    start = i;
  }

  if (groups.length > maxGroups) return `${values.length} different values`;
  return joinList(groups, "and");
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function describeTime(f: Fields): string {
  const allMinutes = !f.minuteRestricted && f.minuteStep === null;
  const allHours = !f.hourRestricted && f.hourStep === null;

  const hourWord = f.hours.length === 1 ? "hour" : "hours";
  const minuteWord = f.minutes.length === 1 ? "minute" : "minutes";
  const hourList = describeNumbers(f.hours, 6);
  const minuteList = describeNumbers(f.minutes, 8);

  if (allMinutes && allHours) return "Every minute";

  if (f.minuteStep !== null && allHours) {
    return `Every ${f.minuteStep} minutes`;
  }

  if (allMinutes && f.hourStep !== null) {
    return `Every minute, every ${f.hourStep} hours`;
  }

  if (allMinutes) {
    return `Every minute during ${hourWord} ${hourList}`;
  }

  if (f.minuteStep !== null) {
    return `Every ${f.minuteStep} minutes during ${hourWord} ${hourList}`;
  }

  if (allHours || f.hourStep !== null) {
    const base = `At ${minuteWord} ${minuteList} of every`;
    return f.hourStep !== null ? `${base} ${f.hourStep} hours` : `${base} hour`;
  }

  const clockTimes = f.minutes.length * f.hours.length;
  if (clockTimes <= 6) {
    const stamps: string[] = [];
    for (const h of f.hours) {
      for (const m of f.minutes) stamps.push(`${pad(h)}:${pad(m)}`);
    }
    stamps.sort();
    return `At ${joinList(stamps, "and")}`;
  }

  return `At ${minuteWord} ${minuteList} past ${hourWord} ${hourList}`;
}

function describeDays(f: Fields): string {
  const parts: string[] = [];

  if (f.domRestricted && f.dowRestricted) {
    parts.push(
      `on the ${joinList(f.doms.map(ordinal), "and")} of the month and on ${joinList(
        f.dows.map((d) => DAY_NAMES[d]),
        "and",
      )}`,
    );
  } else if (f.domRestricted) {
    parts.push(`on the ${joinList(f.doms.map(ordinal), "and")} of the month`);
  } else if (f.dowRestricted) {
    parts.push(
      `on ${joinList(
        f.dows.map((d) => DAY_NAMES[d]),
        "and",
      )}`,
    );
  } else {
    parts.push("every day");
  }

  if (f.monthRestricted) {
    parts.push(
      `in ${joinList(
        f.months.map((m) => MONTH_NAMES[m - 1]),
        "and",
      )}`,
    );
  }

  return parts.join(" ");
}

function describe(f: Fields): string {
  return `${describeTime(f)}, ${describeDays(f)}.`;
}

function dayMatches(f: Fields, date: Date): boolean {
  if (!f.months.includes(date.getMonth() + 1)) return false;

  const dom = date.getDate();
  const dow = date.getDay();

  if (f.domRestricted && f.dowRestricted) {
    return f.doms.includes(dom) || f.dows.includes(dow);
  }
  if (f.domRestricted) return f.doms.includes(dom);
  if (f.dowRestricted) return f.dows.includes(dow);
  return true;
}

function nextRuns(f: Fields, from: Date, count: number): Date[] {
  const out: Date[] = [];
  const start = new Date(from.getTime() + 60000);
  start.setSeconds(0, 0);

  let cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );

  for (let step = 0; step < 1500 && out.length < count; step += 1) {
    if (step > 0) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
      );
    }
    if (!dayMatches(f, cursor)) continue;

    for (const h of f.hours) {
      for (const m of f.minutes) {
        const candidate = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          h,
          m,
          0,
          0,
        );
        if (candidate.getTime() < start.getTime()) continue;
        if (candidate.getHours() !== h || candidate.getMinutes() !== m) continue;
        out.push(candidate);
        if (out.length >= count) break;
      }
      if (out.length >= count) break;
    }
  }

  return out;
}

function formatRun(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeLabel(date: Date, from: Date): string {
  const minutes = Math.round((date.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return "in under a minute";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  if (days < 31) return `in ${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `in about ${months} month${months === 1 ? "" : "s"}`;
}

function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  } catch {
    return "local time";
  }
}

export default function CronExpressionExplainer() {
  const [expression, setExpression] = useState("*/15 9-17 * * 1-5");
  const [countText, setCountText] = useState("8");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const runCount = useMemo(() => {
    const parsed = Number.parseInt(countText, 10);
    if (Number.isNaN(parsed)) return 8;
    return Math.min(25, Math.max(1, parsed));
  }, [countText]);

  const parsed = useMemo(() => parseCron(expression), [expression]);

  const result = useMemo(() => {
    if (!parsed.ok) return null;
    return {
      sentence: describe(parsed.fields),
      runs: now === null ? null : nextRuns(parsed.fields, now, runCount),
      perDay: parsed.fields.minutes.length * parsed.fields.hours.length,
    };
  }, [parsed, now, runCount]);

  const zone = now === null ? "" : timeZoneName();

  const copyText = useMemo(() => {
    if (!parsed.ok || !result) return "";
    const lines = [parsed.normalized, result.sentence];
    if (result.runs !== null) {
      lines.push(`Time zone: ${zone}`, "", "Next runs:");
      for (const run of result.runs) lines.push(`- ${formatRun(run)}`);
    }
    return lines.join("\n");
  }, [parsed, result, zone]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolInput
        label="Cron expression"
        hint="Five fields: minute, hour, day of month, month, day of week. Shortcuts such as @daily also work."
        placeholder="*/15 9-17 * * 1-5"
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="font-mono"
      />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <ToolButton
            key={preset.value}
            variant="secondary"
            size="sm"
            onClick={() => setExpression(preset.value)}
          >
            {preset.label}
          </ToolButton>
        ))}
        <ToolButton variant="ghost" size="sm" onClick={() => setExpression("")}>
          Clear
        </ToolButton>
      </div>

      {!parsed.ok && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
          {parsed.error}
        </div>
      )}

      {parsed.ok && result && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                In plain language
              </span>
              <CopyButton text={copyText} />
            </div>
            <div className="rounded-lg border border-tool-accent/40 bg-tool-accent/5 p-4 text-base text-tool-text">
              {result.sentence}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Next run"
              value={
                result.runs === null
                  ? "Calculating"
                  : result.runs.length > 0
                    ? formatRun(result.runs[0])
                    : "None found"
              }
              sub={
                result.runs === null
                  ? "Reading your time zone"
                  : result.runs.length > 0 && now !== null
                    ? relativeLabel(result.runs[0], now)
                    : "No match in the next four years"
              }
              accent
            />
            <StatCard
              label="Runs per matching day"
              value={result.perDay}
              sub="Times fired on a day that matches"
            />
            <StatCard
              label="Time zone"
              value={zone === "" ? "Loading" : zone}
              sub="Times below use this zone"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Next runs
              </span>
              <div className="flex items-end gap-2">
                <ToolInput
                  label="How many"
                  type="number"
                  min={1}
                  max={25}
                  value={countText}
                  onChange={(e) => setCountText(e.target.value)}
                  className="w-24"
                />
                <ToolButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setNow(new Date())}
                >
                  Refresh
                </ToolButton>
              </div>
            </div>

            {result.runs === null ? (
              <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
                Reading the clock on your device.
              </div>
            ) : result.runs.length === 0 ? (
              <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
                This schedule has no run time in the next four years. Check the day of
                month and month fields.
              </div>
            ) : (
              <ol className="flex flex-col divide-y divide-tool-border rounded-lg border border-tool-border bg-tool-surface">
                {result.runs.map((run) => (
                  <li
                    key={run.getTime()}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-tool-text">
                      {formatRun(run)}
                    </span>
                    <span className="text-xs text-tool-muted">
                      {now === null ? "" : relativeLabel(run, now)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Field by field
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { name: "Minute", values: describeNumbers(parsed.fields.minutes, 60) },
                { name: "Hour", values: describeNumbers(parsed.fields.hours, 24) },
                {
                  name: "Day of month",
                  values: parsed.fields.domRestricted
                    ? describeNumbers(parsed.fields.doms, 31)
                    : "any day",
                },
                {
                  name: "Month",
                  values: parsed.fields.monthRestricted
                    ? joinList(
                        parsed.fields.months.map((m) => MONTH_NAMES[m - 1]),
                        "and",
                      )
                    : "any month",
                },
                {
                  name: "Day of week",
                  values: parsed.fields.dowRestricted
                    ? joinList(
                        parsed.fields.dows.map((d) => DAY_NAMES[d]),
                        "and",
                      )
                    : "any weekday",
                },
              ].map((row) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-tool-border bg-tool-surface px-4 py-3"
                >
                  <div className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                    {row.name}
                  </div>
                  <div className="text-sm text-tool-text">{row.values}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
