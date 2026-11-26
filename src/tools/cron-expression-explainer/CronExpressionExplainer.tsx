import { useEffect, useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useLang, useMessages } from "../../i18n/react";
import { parseCron, nextRuns, groupNumbers, type Fields, type FieldId, type CronError } from "./cron";

const PRESETS = ["*/15 * * * *", "0 9 * * 1-5", "30 8 * * MON", "0 0 1 * *"];
const MAX_RUNS = 25;

/** Localized month and weekday names, from Intl rather than hardcoded tables. */
interface Names {
  month: (m: number) => string;
  day: (d: number) => string;
}

const pad = (v: number) => String(v).padStart(2, "0");

function clockTimes(f: Fields): string[] {
  return f.hours.flatMap((h) => f.minutes.map((m) => `${pad(h)}:${pad(m)}`)).sort();
}

/* ── English ─────────────────────────────────────────────────────────── */

function joinEn(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function numbersEn(values: number[], maxGroups: number): string {
  const groups = groupNumbers(values, maxGroups);
  if (!groups) return `${values.length} different values`;
  return joinEn(groups.map((g) => (g.length === 2 ? `${g[0]} to ${g[1]}` : String(g[0]))));
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

function describeEn(f: Fields, n: Names): string {
  const allMinutes = !f.minuteRestricted && f.minuteStep === null;
  const allHours = !f.hourRestricted && f.hourStep === null;
  const hours = `${f.hours.length === 1 ? "hour" : "hours"} ${numbersEn(f.hours, 6)}`;
  const minutes = `${f.minutes.length === 1 ? "minute" : "minutes"} ${numbersEn(f.minutes, 8)}`;

  let time: string;
  if (allMinutes && allHours) time = "Every minute";
  else if (f.minuteStep !== null && allHours) time = `Every ${f.minuteStep} minutes`;
  else if (allMinutes && f.hourStep !== null) time = `Every minute, every ${f.hourStep} hours`;
  else if (allMinutes) time = `Every minute during ${hours}`;
  else if (f.minuteStep !== null) time = `Every ${f.minuteStep} minutes during ${hours}`;
  else if (f.hourStep !== null) time = `At ${minutes} of every ${f.hourStep} hours`;
  else if (allHours) time = `At ${minutes} of every hour`;
  else if (f.minutes.length * f.hours.length <= 6) time = `At ${joinEn(clockTimes(f))}`;
  else time = `At ${minutes} past ${hours}`;

  const doms = `the ${joinEn(f.doms.map(ordinal))} of the month`;
  const dows = joinEn(f.dows.map(n.day));
  let days: string;
  if (f.domRestricted && f.dowRestricted) days = `on ${doms} and on ${dows}`;
  else if (f.domRestricted) days = `on ${doms}`;
  else if (f.dowRestricted) days = `on ${dows}`;
  else days = "every day";
  if (f.monthRestricted) days += ` in ${joinEn(f.months.map(n.month))}`;

  return `${time}, ${days}.`;
}

/* ── Korean ──────────────────────────────────────────────────────────── */

function numbersKo(values: number[], maxGroups: number, unit: string, noun = "값"): string {
  const groups = groupNumbers(values, maxGroups);
  if (!groups) return `정해진 ${values.length}개 ${noun}`;
  return groups.map((g) => (g.length === 2 ? `${g[0]}~${g[1]}${unit}` : `${g[0]}${unit}`)).join(", ");
}

function describeKo(f: Fields, n: Names): string {
  const allMinutes = !f.minuteRestricted && f.minuteStep === null;
  const allHours = !f.hourRestricted && f.hourStep === null;
  const hours = numbersKo(f.hours, 6, "시", "시간대");
  const minutes = numbersKo(f.minutes, 8, "분", "분");

  let time: string;
  if (allMinutes && allHours) time = "매분";
  else if (f.minuteStep !== null && allHours) time = `${f.minuteStep}분마다`;
  else if (allMinutes && f.hourStep !== null) time = `${f.hourStep}시간마다 매분`;
  else if (allMinutes) time = `${hours} 동안 매분`;
  else if (f.minuteStep !== null) time = `${hours} 동안 ${f.minuteStep}분마다`;
  else if (f.hourStep !== null) time = `${f.hourStep}시간마다 ${minutes}`;
  else if (allHours) time = `매시 ${minutes}`;
  else if (f.minutes.length * f.hours.length <= 6) time = clockTimes(f).join(", ");
  else time = `${hours} ${minutes}`;

  const months = f.monthRestricted ? `${f.months.map(n.month).join(", ")} ` : "";
  const doms = `${f.monthRestricted ? "" : "매월 "}${f.doms.join(", ")}일`;
  const dows = f.dows.map(n.day).join(", ");
  let days: string;
  if (f.domRestricted && f.dowRestricted) days = `${doms} 및 ${dows}`;
  else if (f.domRestricted) days = doms;
  else if (f.dowRestricted) days = dows;
  else days = "매일";

  return `${months}${days} ${time}.`;
}

const messages = {
  en: {
    describe: describeEn,
    presets: ["Every 15 minutes", "Weekdays at 09:00", "Every Monday 08:30", "First of the month"],
    label: "Cron expression",
    hint: "Five fields: minute, hour, day of month, month, day of week. Shortcuts such as @daily also work.",
    clear: "Clear",
    fields: { minute: "minute", hour: "hour", dom: "day of month", month: "month", dow: "day of week" } as Record<FieldId, string>,
    error: (e: CronError, label: (f: FieldId) => string): string => {
      switch (e.code) {
        case "empty": return "Enter a cron expression.";
        case "fieldCount": return `A cron expression needs 5 fields separated by spaces, but ${e.count} ${e.count === 1 ? "was" : "were"} found.`;
        case "fieldEmpty": return `The ${label(e.field)} field is empty.`;
        case "emptyItem": return `The ${label(e.field)} field has an empty item.`;
        case "badStep": return `The ${label(e.field)} field has an invalid step "${e.text}".`;
        case "stepTooSmall": return `The ${label(e.field)} step must be 1 or more.`;
        case "noMatch": return `The ${label(e.field)} field does not match any value.`;
        case "missingValue": return `The ${label(e.field)} field is missing a value.`;
        case "badValue": return `"${e.text}" is not a valid ${label(e.field)} value.`;
        case "outOfRange": {
          const l = label(e.field);
          return `${l.charAt(0).toUpperCase() + l.slice(1)} values must be between ${e.min} and ${e.max}, but got ${e.value}.`;
        }
      }
    },
    plainLanguage: "In plain language",
    nextRun: "Next run",
    calculating: "Calculating",
    readingZone: "Reading your time zone",
    noneFound: "None found",
    noMatchYears: "No match in the next four years",
    underMinute: "in under a minute",
    perDay: "Runs per matching day",
    perDaySub: "Times fired on a day that matches",
    timeZone: "Time zone",
    loading: "Loading",
    zoneSub: "Times below use this zone",
    nextRuns: "Next runs",
    howMany: "How many",
    refresh: "Refresh",
    readingClock: "Reading the clock on your device.",
    noRuns: "This schedule has no run time in the next four years. Check the day of month and month fields.",
    fieldByField: "Field by field",
    fieldNames: { minute: "Minute", hour: "Hour", dom: "Day of month", month: "Month", dow: "Day of week" } as Record<FieldId, string>,
    numbers: (values: number[], max: number) => numbersEn(values, max),
    list: joinEn,
    anyDay: "any day",
    anyMonth: "any month",
    anyWeekday: "any weekday",
    copyZone: (z: string) => `Time zone: ${z}`,
  },
  ko: {
    describe: describeKo,
    presets: ["15분마다", "평일 09:00", "매주 월요일 08:30", "매월 1일"],
    label: "크론 표현식",
    hint: "다섯 필드: 분, 시, 일, 월, 요일. @daily 같은 단축 표현도 쓸 수 있습니다.",
    clear: "지우기",
    fields: { minute: "분", hour: "시", dom: "일", month: "월", dow: "요일" } as Record<FieldId, string>,
    error: (e: CronError, label: (f: FieldId) => string): string => {
      switch (e.code) {
        case "empty": return "크론 표현식을 입력하세요.";
        case "fieldCount": return `크론 표현식은 공백으로 구분된 필드 5개가 필요한데 ${e.count}개가 있습니다.`;
        case "fieldEmpty": return `${label(e.field)} 필드가 비어 있습니다.`;
        case "emptyItem": return `${label(e.field)} 필드에 빈 항목이 있습니다.`;
        case "badStep": return `${label(e.field)} 필드의 간격 "${e.text}"이(가) 올바르지 않습니다.`;
        case "stepTooSmall": return `${label(e.field)} 간격은 1 이상이어야 합니다.`;
        case "noMatch": return `${label(e.field)} 필드에 해당하는 값이 없습니다.`;
        case "missingValue": return `${label(e.field)} 필드에 값이 빠져 있습니다.`;
        case "badValue": return `"${e.text}"은(는) 올바른 ${label(e.field)} 값이 아닙니다.`;
        case "outOfRange": return `${label(e.field)} 값은 ${e.min}에서 ${e.max} 사이여야 하는데 ${e.value}입니다.`;
      }
    },
    plainLanguage: "쉬운 말로",
    nextRun: "다음 실행",
    calculating: "계산 중",
    readingZone: "시간대를 확인하는 중",
    noneFound: "없음",
    noMatchYears: "앞으로 4년 안에 해당하는 시각이 없습니다",
    underMinute: "1분 이내",
    perDay: "해당 날의 실행 횟수",
    perDaySub: "조건에 맞는 날 하루 동안 실행되는 횟수",
    timeZone: "시간대",
    loading: "불러오는 중",
    zoneSub: "아래 시각은 이 시간대 기준입니다",
    nextRuns: "다음 실행 시각",
    howMany: "개수",
    refresh: "새로 고침",
    readingClock: "기기의 시계를 읽는 중입니다.",
    noRuns: "이 일정은 앞으로 4년 안에 실행 시각이 없습니다. 일과 월 필드를 확인하세요.",
    fieldByField: "필드별 설명",
    fieldNames: { minute: "분", hour: "시", dom: "일", month: "월", dow: "요일" } as Record<FieldId, string>,
    numbers: (values: number[], max: number) => numbersKo(values, max, ""),
    list: (items: string[]) => items.join(", "),
    anyDay: "모든 날",
    anyMonth: "모든 달",
    anyWeekday: "모든 요일",
    copyZone: (z: string) => `시간대: ${z}`,
  },
};

export default function CronExpressionExplainer() {
  const m = useMessages(messages);
  const lang = useLang();
  const [expression, setExpression] = useState("*/15 9-17 * * 1-5");
  const [countText, setCountText] = useState("8");
  const [now, setNow] = useState<Date | null>(null);

  // Read the clock after mount so the static HTML does not bake in the build time.
  useEffect(() => setNow(new Date()), []);

  const names = useMemo<Names>(() => {
    const monthFmt = new Intl.DateTimeFormat(lang, { month: "long" });
    const dayFmt = new Intl.DateTimeFormat(lang, { weekday: "long" });
    return {
      month: (month) => monthFmt.format(new Date(2000, month - 1, 1)),
      // 2023-01-01 was a Sunday.
      day: (day) => dayFmt.format(new Date(2023, 0, 1 + day)),
    };
  }, [lang]);

  const formatRun = (date: Date) =>
    date.toLocaleString(lang, { weekday: "short", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const relativeLabel = (date: Date, from: Date) => {
    const minutes = Math.round((date.getTime() - from.getTime()) / 60000);
    if (minutes < 1) return m.underMinute;
    const fmt = new Intl.RelativeTimeFormat(lang, { numeric: "always" });
    if (minutes < 60) return fmt.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (hours < 24) return fmt.format(hours, "hour");
    const days = Math.round(hours / 24);
    return days < 31 ? fmt.format(days, "day") : fmt.format(Math.round(days / 30), "month");
  };

  const parsedCount = Number.parseInt(countText, 10);
  const runCount = Number.isNaN(parsedCount) ? 8 : Math.min(MAX_RUNS, Math.max(1, parsedCount));
  const parsed = useMemo(() => parseCron(expression), [expression]);
  const runs = useMemo(() => (parsed.ok && now ? nextRuns(parsed.fields, now, runCount) : null), [parsed, now, runCount]);
  const zone = now === null ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!parsed.ok) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <ExpressionInput m={m} expression={expression} setExpression={setExpression} />
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
          {m.error(parsed.error, (f) => m.fields[f])}
        </div>
      </div>
    );
  }

  const f = parsed.fields;
  const sentence = m.describe(f, names);
  const copyText = [
    parsed.normalized,
    sentence,
    ...(runs ? [m.copyZone(zone), "", `${m.nextRuns}:`, ...runs.map((run) => `- ${formatRun(run)}`)] : []),
  ].join("\n");

  const fieldRows: { id: FieldId; value: string }[] = [
    { id: "minute", value: m.numbers(f.minutes, 60) },
    { id: "hour", value: m.numbers(f.hours, 24) },
    { id: "dom", value: f.domRestricted ? m.numbers(f.doms, 31) : m.anyDay },
    { id: "month", value: f.monthRestricted ? m.list(f.months.map(names.month)) : m.anyMonth },
    { id: "dow", value: f.dowRestricted ? m.list(f.dows.map(names.day)) : m.anyWeekday },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ExpressionInput m={m} expression={expression} setExpression={setExpression} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.plainLanguage}</span>
          <CopyButton text={copyText} />
        </div>
        <div className="rounded-lg border border-tool-accent/40 bg-tool-accent/5 p-4 text-base text-tool-text">{sentence}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={m.nextRun}
          value={runs === null ? m.calculating : runs.length > 0 ? formatRun(runs[0]) : m.noneFound}
          sub={runs === null ? m.readingZone : runs.length > 0 && now ? relativeLabel(runs[0], now) : m.noMatchYears}
          accent
        />
        <StatCard label={m.perDay} value={f.minutes.length * f.hours.length} sub={m.perDaySub} />
        <StatCard label={m.timeZone} value={zone || m.loading} sub={m.zoneSub} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.nextRuns}</span>
          <div className="flex items-end gap-2">
            <ToolInput
              label={m.howMany}
              type="number"
              min={1}
              max={MAX_RUNS}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              className="w-24"
            />
            <ToolButton variant="ghost" size="sm" onClick={() => setNow(new Date())}>
              {m.refresh}
            </ToolButton>
          </div>
        </div>

        {runs === null || runs.length === 0 ? (
          <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
            {runs === null ? m.readingClock : m.noRuns}
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-tool-border rounded-lg border border-tool-border bg-tool-surface">
            {runs.map((run) => (
              <li key={run.getTime()} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-mono text-sm text-tool-text">{formatRun(run)}</span>
                <span className="text-xs text-tool-muted">{now && relativeLabel(run, now)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.fieldByField}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {fieldRows.map((row) => (
            <div key={row.id} className="rounded-lg border border-tool-border bg-tool-surface px-4 py-3">
              <div className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.fieldNames[row.id]}</div>
              <div className="text-sm text-tool-text">{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpressionInput({
  m,
  expression,
  setExpression,
}: {
  m: (typeof messages)["en"];
  expression: string;
  setExpression: (v: string) => void;
}) {
  return (
    <>
      <ToolInput
        label={m.label}
        hint={m.hint}
        placeholder="*/15 9-17 * * 1-5"
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="font-mono"
      />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((value, i) => (
          <ToolButton key={value} variant="secondary" size="sm" onClick={() => setExpression(value)}>
            {m.presets[i]}
          </ToolButton>
        ))}
        <ToolButton variant="ghost" size="sm" onClick={() => setExpression("")}>
          {m.clear}
        </ToolButton>
      </div>
    </>
  );
}
