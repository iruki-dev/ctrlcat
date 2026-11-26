export type FieldId = "minute" | "hour" | "dom" | "month" | "dow";

export interface Fields {
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[];
  minuteRestricted: boolean;
  hourRestricted: boolean;
  domRestricted: boolean;
  monthRestricted: boolean;
  dowRestricted: boolean;
  minuteStep: number | null;
  hourStep: number | null;
}

export type CronError =
  | { code: "empty" }
  | { code: "fieldCount"; count: number }
  | { code: "fieldEmpty" | "emptyItem" | "stepTooSmall" | "noMatch" | "missingValue"; field: FieldId }
  | { code: "badStep" | "badValue"; field: FieldId; text: string }
  | { code: "outOfRange"; field: FieldId; min: number; max: number; value: number };

export type ParseResult = { ok: true; fields: Fields; normalized: string } | { ok: false; error: CronError };

class CronParseError extends Error {
  constructor(readonly error: CronError) {
    super(error.code);
  }
}
const fail = (error: CronError): never => {
  throw new CronParseError(error);
};

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const DAY_ALIASES: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const SPECS: { field: FieldId; min: number; max: number; aliases: Record<string, number> | null }[] = [
  { field: "minute", min: 0, max: 59, aliases: null },
  { field: "hour", min: 0, max: 23, aliases: null },
  { field: "dom", min: 1, max: 31, aliases: null },
  { field: "month", min: 1, max: 12, aliases: MONTH_ALIASES },
  { field: "dow", min: 0, max: 6, aliases: DAY_ALIASES },
];

function readValue(raw: string, spec: (typeof SPECS)[number]): number {
  const text = raw.trim();
  const { field, min, max, aliases } = spec;
  if (text === "") fail({ code: "missingValue", field });

  let value: number;
  if (/^\d+$/.test(text)) value = Number(text);
  else if (aliases?.[text.toLowerCase()] !== undefined) value = aliases[text.toLowerCase()];
  else return fail({ code: "badValue", field, text });

  // Both 0 and 7 mean Sunday.
  if (field === "dow" && value === 7) value = 0;
  if (value < min || value > max) fail({ code: "outOfRange", field, min, max, value });
  return value;
}

function parseField(raw: string, spec: (typeof SPECS)[number]) {
  const { field, min, max } = spec;
  const text = raw.trim() === "?" ? "*" : raw.trim();
  if (text === "") fail({ code: "fieldEmpty", field });

  const found = new Set<number>();
  let restricted = true;
  let step: number | null = null;

  for (const part of text.split(",")) {
    const piece = part.trim();
    if (piece === "") fail({ code: "emptyItem", field });

    let rangeText = piece;
    let stepValue = 1;
    const slash = piece.indexOf("/");
    if (slash !== -1) {
      rangeText = piece.slice(0, slash).trim();
      const stepText = piece.slice(slash + 1).trim();
      if (!/^\d+$/.test(stepText)) fail({ code: "badStep", field, text: stepText });
      stepValue = Number(stepText);
      if (stepValue < 1) fail({ code: "stepTooSmall", field });
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
        from = readValue(rangeText.slice(0, dash), spec);
        to = readValue(rangeText.slice(dash + 1), spec);
      } else {
        from = readValue(rangeText, spec);
        to = slash !== -1 ? max : from;
      }
    }

    // A reversed range such as FRI-MON wraps around the end of the field.
    if (from > to) {
      for (let v = from; v <= max; v += stepValue) found.add(v);
      for (let v = min; v <= to; v += stepValue) found.add(v);
    } else {
      for (let v = from; v <= to; v += stepValue) found.add(v);
    }
  }

  const values = [...found].sort((a, b) => a - b);
  if (values.length === 0) fail({ code: "noMatch", field });
  return { values, restricted, step };
}

export function parseCron(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: { code: "empty" } };

  const parts = (MACROS[trimmed.toLowerCase()] ?? trimmed).split(/\s+/);
  if (parts.length !== 5) return { ok: false, error: { code: "fieldCount", count: parts.length } };

  try {
    const [minute, hour, dom, month, dow] = SPECS.map((spec, i) => parseField(parts[i], spec));
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
    if (err instanceof CronParseError) return { ok: false, error: err.error };
    throw err;
  }
}

/** Consecutive runs of 3+ collapse into a range. Returns null when there are more than maxGroups groups. */
export function groupNumbers(values: number[], maxGroups: number): ([number] | [number, number])[] | null {
  const groups: ([number] | [number, number])[] = [];
  let start = 0;
  for (let i = 1; i <= values.length; i++) {
    if (i < values.length && values[i] === values[i - 1] + 1) continue;
    if (i - start >= 3) groups.push([values[start], values[i - 1]]);
    else for (let j = start; j < i; j++) groups.push([values[j]]);
    start = i;
  }
  return groups.length > maxGroups ? null : groups;
}

function dayMatches(f: Fields, date: Date): boolean {
  if (!f.months.includes(date.getMonth() + 1)) return false;
  const dom = date.getDate();
  const dow = date.getDay();
  // Standard cron: when both day fields are restricted, either one matching is enough.
  if (f.domRestricted && f.dowRestricted) return f.doms.includes(dom) || f.dows.includes(dow);
  if (f.domRestricted) return f.doms.includes(dom);
  if (f.dowRestricted) return f.dows.includes(dow);
  return true;
}

/** Scans up to ~4 years of days ahead of `from`. */
export function nextRuns(f: Fields, from: Date, count: number): Date[] {
  const out: Date[] = [];
  const start = new Date(from.getTime() + 60000);
  start.setSeconds(0, 0);

  for (let step = 0; step < 1500 && out.length < count; step++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + step);
    if (!dayMatches(f, day)) continue;
    for (const h of f.hours) {
      for (const m of f.minutes) {
        const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        // Skip times that fall before the start or that do not exist (DST gaps).
        if (candidate < start || candidate.getHours() !== h || candidate.getMinutes() !== m) continue;
        out.push(candidate);
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}
