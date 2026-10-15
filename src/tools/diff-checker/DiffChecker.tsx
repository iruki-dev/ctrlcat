import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Op = "equal" | "add" | "remove";

interface Row {
  op: Op;
  text: string;
  leftNo: number | null;
  rightNo: number | null;
}

/* Beyond this many cells the LCS table gets too heavy for the browser,
   so the middle section is reported as one replaced block instead. */
const MAX_CELLS = 2_000_000;

function normalize(line: string, ignoreWhitespace: boolean, ignoreCase: boolean) {
  let value = line;
  if (ignoreWhitespace) value = value.replace(/\s+/g, " ").trim();
  if (ignoreCase) value = value.toLowerCase();
  return value;
}

function splitLines(text: string) {
  if (text === "") return [];
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function buildDiff(
  left: string[],
  right: string[],
  ignoreWhitespace: boolean,
  ignoreCase: boolean,
): { rows: Row[]; approximate: boolean } {
  const a = left.map((line) => normalize(line, ignoreWhitespace, ignoreCase));
  const b = right.map((line) => normalize(line, ignoreWhitespace, ignoreCase));

  const rows: Row[] = [];

  // Matching head and tail never need the expensive comparison.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) {
    rows.push({
      op: "equal",
      text: right[head],
      leftNo: head + 1,
      rightNo: head + 1,
    });
    head += 1;
  }

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const aMid = a.slice(head, a.length - tail);
  const bMid = b.slice(head, b.length - tail);
  const n = aMid.length;
  const m = bMid.length;
  const approximate = n * m > MAX_CELLS;

  if (approximate) {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        op: "remove",
        text: left[head + i],
        leftNo: head + i + 1,
        rightNo: null,
      });
    }
    for (let j = 0; j < m; j += 1) {
      rows.push({
        op: "add",
        text: right[head + j],
        leftNo: null,
        rightNo: head + j + 1,
      });
    }
  } else {
    // table[i][j] = length of the longest common subsequence of aMid[i:] and bMid[j:]
    const table: Uint32Array[] = [];
    for (let i = 0; i <= n; i += 1) table.push(new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        table[i][j] =
          aMid[i] === bMid[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (aMid[i] === bMid[j]) {
        rows.push({
          op: "equal",
          text: right[head + j],
          leftNo: head + i + 1,
          rightNo: head + j + 1,
        });
        i += 1;
        j += 1;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        rows.push({
          op: "remove",
          text: left[head + i],
          leftNo: head + i + 1,
          rightNo: null,
        });
        i += 1;
      } else {
        rows.push({
          op: "add",
          text: right[head + j],
          leftNo: null,
          rightNo: head + j + 1,
        });
        j += 1;
      }
    }
    while (i < n) {
      rows.push({
        op: "remove",
        text: left[head + i],
        leftNo: head + i + 1,
        rightNo: null,
      });
      i += 1;
    }
    while (j < m) {
      rows.push({
        op: "add",
        text: right[head + j],
        leftNo: null,
        rightNo: head + j + 1,
      });
      j += 1;
    }
  }

  for (let k = tail; k > 0; k -= 1) {
    rows.push({
      op: "equal",
      text: right[right.length - k],
      leftNo: left.length - k + 1,
      rightNo: right.length - k + 1,
    });
  }

  return { rows, approximate };
}

const marker: Record<Op, string> = { equal: " ", add: "+", remove: "-" };

const rowClass: Record<Op, string> = {
  equal: "bg-transparent text-tool-text-dim",
  add: "bg-emerald-500/10 text-tool-text",
  remove: "bg-rose-500/10 text-tool-text",
};

const markerClass: Record<Op, string> = {
  equal: "text-tool-muted",
  add: "text-emerald-600",
  remove: "text-rose-600",
};

export default function DiffChecker() {
  const [original, setOriginal] = useState("");
  const [changed, setChanged] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);

  const hasInput = original !== "" || changed !== "";

  const { rows, approximate } = useMemo(() => {
    if (!hasInput) return { rows: [] as Row[], approximate: false };
    return buildDiff(
      splitLines(original),
      splitLines(changed),
      ignoreWhitespace,
      ignoreCase,
    );
  }, [original, changed, ignoreWhitespace, ignoreCase, hasInput]);

  const added = rows.filter((row) => row.op === "add").length;
  const removed = rows.filter((row) => row.op === "remove").length;
  const unchanged = rows.length - added - removed;
  const visible = onlyChanged ? rows.filter((row) => row.op !== "equal") : rows;

  const unified = rows
    .map((row) => `${marker[row.op]}${row.text}`)
    .join("\n");

  const clear = () => {
    setOriginal("");
    setChanged("");
  };

  const swap = () => {
    setOriginal(changed);
    setChanged(original);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2">
        <ToolTextarea
          label="Original"
          placeholder="Paste the earlier version here"
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          rows={12}
          spellCheck={false}
          className="font-mono text-sm"
        />
        <ToolTextarea
          label="Changed"
          placeholder="Paste the newer version here"
          value={changed}
          onChange={(e) => setChanged(e.target.value)}
          rows={12}
          spellCheck={false}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-tool-text-dim cursor-pointer">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
            className="h-4 w-4 accent-tool-accent"
          />
          Ignore whitespace
        </label>
        <label className="flex items-center gap-2 text-sm text-tool-text-dim cursor-pointer">
          <input
            type="checkbox"
            checked={ignoreCase}
            onChange={(e) => setIgnoreCase(e.target.checked)}
            className="h-4 w-4 accent-tool-accent"
          />
          Ignore case
        </label>
        <label className="flex items-center gap-2 text-sm text-tool-text-dim cursor-pointer">
          <input
            type="checkbox"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
            className="h-4 w-4 accent-tool-accent"
          />
          Only changed lines
        </label>
        <div className="flex gap-2 ml-auto">
          <ToolButton variant="secondary" onClick={swap} disabled={!hasInput}>
            Swap sides
          </ToolButton>
          <ToolButton variant="ghost" onClick={clear} disabled={!hasInput}>
            Clear
          </ToolButton>
        </div>
      </div>

      {hasInput && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Added lines" value={added} accent={added > 0} />
            <StatCard label="Removed lines" value={removed} accent={removed > 0} />
            <StatCard label="Unchanged lines" value={unchanged} />
          </div>

          {added === 0 && removed === 0 ? (
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">
              The two versions match under the current settings.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                  Differences
                </span>
                <CopyButton text={unified} />
              </div>
              {approximate && (
                <p className="text-xs text-tool-muted">
                  The input is large, so the changed section is reported as one
                  replaced block rather than line by line.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-tool-border bg-tool-surface">
                <table className="w-full border-collapse font-mono text-sm">
                  <tbody>
                    {visible.map((row, index) => (
                      <tr key={index} className={rowClass[row.op]}>
                        <td className="w-12 select-none border-r border-tool-border px-2 py-0.5 text-right align-top text-xs text-tool-muted">
                          {row.leftNo ?? ""}
                        </td>
                        <td className="w-12 select-none border-r border-tool-border px-2 py-0.5 text-right align-top text-xs text-tool-muted">
                          {row.rightNo ?? ""}
                        </td>
                        <td
                          className={`w-6 select-none px-2 py-0.5 text-center align-top font-semibold ${markerClass[row.op]}`}
                        >
                          {marker[row.op]}
                        </td>
                        <td className="px-2 py-0.5 align-top whitespace-pre-wrap break-all">
                          {row.text === "" ? " " : row.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
