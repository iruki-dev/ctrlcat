import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";

type Direction = "csv-to-json" | "json-to-csv";
type JsonValue = string | number | boolean | null;
type SeparatorId = "comma" | "tab" | "semicolon" | "pipe";
type ErrorCode = "noRows" | "invalidJson" | "emptyArray" | "noFields";

const SEPARATORS: Record<SeparatorId, string> = { comma: ",", tab: "\t", semicolon: ";", pipe: "|" };

const messages = {
  en: {
    toJson: "CSV to JSON",
    toCsv: "JSON to CSV",
    separator: "Separator",
    separators: { comma: "Comma", tab: "Tab", semicolon: "Semicolon", pipe: "Pipe" } as Record<SeparatorId, string>,
    header: "First row holds the field names",
    detectTypes: "Detect numbers and true or false",
    csvInput: "CSV input",
    jsonInput: "JSON input",
    convert: "Convert",
    clear: "Clear",
    rows: "Rows",
    columns: "Columns",
    characters: "Characters",
    jsonOutput: "JSON output",
    csvOutput: "CSV output",
    errors: {
      noRows: "No rows found in the input.",
      invalidJson: "That is not valid JSON.",
      emptyArray: "The JSON array is empty.",
      noFields: "The records have no fields.",
    } as Record<ErrorCode, string>,
  },
  ko: {
    toJson: "CSV → JSON",
    toCsv: "JSON → CSV",
    separator: "구분자",
    separators: { comma: "쉼표", tab: "탭", semicolon: "세미콜론", pipe: "파이프" } as Record<SeparatorId, string>,
    header: "첫 줄을 필드 이름으로 사용",
    detectTypes: "숫자와 true/false 자동 인식",
    csvInput: "CSV 입력",
    jsonInput: "JSON 입력",
    convert: "변환",
    clear: "지우기",
    rows: "행",
    columns: "열",
    characters: "글자",
    jsonOutput: "JSON 결과",
    csvOutput: "CSV 결과",
    errors: {
      noRows: "입력에서 행을 찾을 수 없습니다.",
      invalidJson: "올바른 JSON이 아닙니다.",
      emptyArray: "JSON 배열이 비어 있습니다.",
      noFields: "레코드에 필드가 없습니다.",
    } as Record<ErrorCode, string>,
  },
};

const PLACEHOLDER: Record<Direction, string> = {
  "csv-to-json": "name,city\nAda,London\nGrace,New York",
  "json-to-csv": '[{ "name": "Ada", "city": "London" }]',
};

const maxLength = (rows: unknown[][]) => rows.reduce((max, row) => Math.max(max, row.length), 0);

class ConvertError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

/** RFC 4180-style parser: quoted fields, doubled quotes, CR/LF/CRLF line ends. */
function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let inQuotes = false;

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

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else inQuotes = false;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
      quoted = true;
    } else if (ch === sep) {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || quoted || row.length > 0) endRow();

  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function coerce(raw: string): JsonValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

function escapeCsv(value: string, sep: string): string {
  const needsQuotes = /["\r\n]/.test(value) || value.includes(sep) || value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

type Result = { text: string; rows: number; columns: number };

function csvToJson(input: string, sep: string, header: boolean, detectTypes: boolean): Result {
  const grid = parseCsv(input, sep);
  if (grid.length === 0) throw new ConvertError("noRows");

  const width = maxLength(grid);
  const names = Array.from({ length: width }, (_, c) => (header ? grid[0][c]?.trim() : "") || `field_${c + 1}`);

  const records = (header ? grid.slice(1) : grid).map((row) =>
    Object.fromEntries(names.map((name, c) => [name, detectTypes ? coerce(row[c] ?? "") : (row[c] ?? "")])),
  );

  return { text: JSON.stringify(records, null, 2), rows: records.length, columns: width };
}

function jsonToCsv(input: string, sep: string): Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new ConvertError("invalidJson");
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) throw new ConvertError("emptyArray");

  let names: string[];
  let grid: string[][];

  if (items.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
    const records = items as Record<string, unknown>[];
    names = [...new Set(records.flatMap((item) => Object.keys(item)))];
    if (names.length === 0) throw new ConvertError("noFields");
    grid = records.map((item) => names.map((name) => cellToText(item[name])));
  } else if (items.every((item) => Array.isArray(item))) {
    const rows = items as unknown[][];
    const width = maxLength(rows);
    names = Array.from({ length: width }, (_, c) => `field_${c + 1}`);
    grid = rows.map((row) => names.map((_, c) => cellToText(row[c])));
  } else {
    names = ["value"];
    grid = items.map((item) => [cellToText(item)]);
  }

  const lines = [names, ...grid].map((row) => row.map((cell) => escapeCsv(cell, sep)).join(sep));
  return { text: lines.join("\n"), rows: grid.length, columns: names.length };
}

export default function CsvToJsonConverter() {
  const m = useMessages(messages);
  const [direction, setDirection] = useState<Direction>("csv-to-json");
  const [separator, setSeparator] = useState<SeparatorId>("comma");
  const [header, setHeader] = useState(true);
  const [detectTypes, setDetectTypes] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);

  const toJson = direction === "csv-to-json";

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const convert = () => {
    reset();
    const sep = SEPARATORS[separator];
    try {
      setResult(toJson ? csvToJson(input, sep, header, detectTypes) : jsonToCsv(input, sep));
    } catch (e) {
      if (!(e instanceof ConvertError)) throw e;
      setError(e.code);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {(["csv-to-json", "json-to-csv"] as const).map((d) => (
          <ToolButton
            key={d}
            size="sm"
            variant={direction === d ? "primary" : "secondary"}
            onClick={() => {
              setDirection(d);
              reset();
            }}
          >
            {d === "csv-to-json" ? m.toJson : m.toCsv}
          </ToolButton>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-tool-border bg-tool-surface p-4">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.separator}</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SEPARATORS) as SeparatorId[]).map((id) => (
            <ToolButton key={id} size="sm" variant={id === separator ? "primary" : "ghost"} onClick={() => setSeparator(id)}>
              {m.separators[id]}
            </ToolButton>
          ))}
        </div>
        {toJson && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-tool-text-dim">
              <input type="checkbox" className="h-4 w-4 accent-tool-accent" checked={header} onChange={(e) => setHeader(e.target.checked)} />
              {m.header}
            </label>
            <label className="flex items-center gap-2 text-sm text-tool-text-dim">
              <input
                type="checkbox"
                className="h-4 w-4 accent-tool-accent"
                checked={detectTypes}
                onChange={(e) => setDetectTypes(e.target.checked)}
              />
              {m.detectTypes}
            </label>
          </div>
        )}
      </div>

      <ToolTextarea
        label={toJson ? m.csvInput : m.jsonInput}
        placeholder={PLACEHOLDER[direction]}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
      />

      <div className="flex gap-2">
        <ToolButton onClick={convert} disabled={input.trim() === ""}>
          {m.convert}
        </ToolButton>
        <ToolButton
          variant="ghost"
          onClick={() => {
            setInput("");
            reset();
          }}
        >
          {m.clear}
        </ToolButton>
      </div>

      {error && <ToolNotice>{m.errors[error]}</ToolNotice>}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={m.rows} value={result.rows} accent />
            <StatCard label={m.columns} value={result.columns} />
            <StatCard label={m.characters} value={result.text.length} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                {toJson ? m.jsonOutput : m.csvOutput}
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
