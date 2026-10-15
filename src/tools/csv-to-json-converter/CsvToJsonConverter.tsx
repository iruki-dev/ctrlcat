import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Direction = "csv-to-json" | "json-to-csv";
type JsonValue = string | number | boolean | null;

const separators = [
  { id: "comma", label: "Comma", char: "," },
  { id: "tab", label: "Tab", char: "\t" },
  { id: "semicolon", label: "Semicolon", char: ";" },
  { id: "pipe", label: "Pipe", char: "|" },
];

function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
    quoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === sep) {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== "" || quoted || row.length > 0) endRow();

  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function coerce(raw: string): JsonValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed !== "" && /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

function escapeCsv(value: string, sep: string): string {
  const needsQuotes =
    value.includes(sep) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type Result = { text: string; rows: number; columns: number };

function csvToJson(
  input: string,
  sep: string,
  header: boolean,
  detectTypes: boolean,
): Result {
  const grid = parseCsv(input, sep);
  if (grid.length === 0) throw new Error("No rows found in the input.");

  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const names: string[] = [];
  for (let c = 0; c < width; c += 1) {
    const raw = header ? (grid[0][c] ?? "").trim() : "";
    names.push(raw === "" ? `field_${c + 1}` : raw);
  }

  const body = header ? grid.slice(1) : grid;
  const records = body.map((row) => {
    const record: Record<string, JsonValue> = {};
    names.forEach((name, c) => {
      const cell = row[c] ?? "";
      record[name] = detectTypes ? coerce(cell) : cell;
    });
    return record;
  });

  return {
    text: JSON.stringify(records, null, 2),
    rows: records.length,
    columns: width,
  };
}

function jsonToCsv(input: string, sep: string): Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("That is not valid JSON.");
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) throw new Error("The JSON array is empty.");

  const objects = items.every(
    (item) => item !== null && typeof item === "object" && !Array.isArray(item),
  );

  let names: string[];
  let grid: string[][];

  if (objects) {
    const seen: string[] = [];
    (items as Record<string, unknown>[]).forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (!seen.includes(key)) seen.push(key);
      });
    });
    if (seen.length === 0) throw new Error("The records have no fields.");
    names = seen;
    grid = (items as Record<string, unknown>[]).map((item) =>
      names.map((name) => cellToText(item[name])),
    );
  } else if (items.every((item) => Array.isArray(item))) {
    const width = (items as unknown[][]).reduce(
      (max, row) => Math.max(max, row.length),
      0,
    );
    names = Array.from({ length: width }, (_, c) => `field_${c + 1}`);
    grid = (items as unknown[][]).map((row) =>
      names.map((_, c) => cellToText(row[c])),
    );
  } else {
    names = ["value"];
    grid = items.map((item) => [cellToText(item)]);
  }

  const lines = [names.map((name) => escapeCsv(name, sep)).join(sep)];
  grid.forEach((row) => {
    lines.push(row.map((cell) => escapeCsv(cell, sep)).join(sep));
  });

  return { text: lines.join("\n"), rows: grid.length, columns: names.length };
}

export default function CsvToJsonConverter() {
  const [direction, setDirection] = useState<Direction>("csv-to-json");
  const [separator, setSeparator] = useState("comma");
  const [header, setHeader] = useState(true);
  const [detectTypes, setDetectTypes] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const sepChar = separators.find((s) => s.id === separator)?.char ?? ",";
  const toJson = direction === "csv-to-json";

  const convert = () => {
    try {
      setResult(
        toJson
          ? csvToJson(input, sepChar, header, detectTypes)
          : jsonToCsv(input, sepChar),
      );
      setError("");
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not convert that input.");
    }
  };

  const switchDirection = (next: Direction) => {
    setDirection(next);
    setResult(null);
    setError("");
  };

  const clear = () => {
    setInput("");
    setResult(null);
    setError("");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        <ToolButton
          size="sm"
          variant={toJson ? "primary" : "secondary"}
          onClick={() => switchDirection("csv-to-json")}
        >
          CSV to JSON
        </ToolButton>
        <ToolButton
          size="sm"
          variant={toJson ? "secondary" : "primary"}
          onClick={() => switchDirection("json-to-csv")}
        >
          JSON to CSV
        </ToolButton>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-tool-border bg-tool-surface p-4">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
          Separator
        </span>
        <div className="flex flex-wrap gap-2">
          {separators.map((s) => (
            <ToolButton
              key={s.id}
              size="sm"
              variant={s.id === separator ? "primary" : "ghost"}
              onClick={() => setSeparator(s.id)}
            >
              {s.label}
            </ToolButton>
          ))}
        </div>
        {toJson && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-tool-text-dim">
              <input
                type="checkbox"
                className="h-4 w-4 accent-tool-accent"
                checked={header}
                onChange={(e) => setHeader(e.target.checked)}
              />
              First row holds the field names
            </label>
            <label className="flex items-center gap-2 text-sm text-tool-text-dim">
              <input
                type="checkbox"
                className="h-4 w-4 accent-tool-accent"
                checked={detectTypes}
                onChange={(e) => setDetectTypes(e.target.checked)}
              />
              Detect numbers and true or false
            </label>
          </div>
        )}
      </div>

      <ToolTextarea
        label={toJson ? "CSV input" : "JSON input"}
        placeholder={
          toJson
            ? "name,city\nAda,London\nGrace,New York"
            : '[{ "name": "Ada", "city": "London" }]'
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        className="font-mono"
      />

      <div className="flex gap-2">
        <ToolButton onClick={convert} disabled={input.trim() === ""}>
          Convert
        </ToolButton>
        <ToolButton variant="ghost" onClick={clear}>
          Clear
        </ToolButton>
      </div>

      {error !== "" && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Rows" value={result.rows} accent />
            <StatCard label="Columns" value={result.columns} />
            <StatCard label="Characters" value={result.text.length} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                {toJson ? "JSON output" : "CSV output"}
              </span>
              <CopyButton text={result.text} />
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {result.text}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
