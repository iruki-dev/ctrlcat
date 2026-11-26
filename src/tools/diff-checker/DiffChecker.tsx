import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

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

const messages = {
  en: {
    original: "Original",
    originalPlaceholder: "Paste the earlier version here",
    changed: "Changed",
    changedPlaceholder: "Paste the newer version here",
    ignoreWhitespace: "Ignore whitespace",
    ignoreCase: "Ignore case",
    onlyChanged: "Only changed lines",
    swap: "Swap sides",
    clear: "Clear",
    added: "Added lines",
    removed: "Removed lines",
    unchanged: "Unchanged lines",
    identical: "The two versions match under the current settings.",
    differences: "Differences",
    approximate: "The input is large, so the changed section is reported as one replaced block rather than line by line.",
  },
  ko: {
    original: "원본",
    originalPlaceholder: "이전 버전을 붙여넣으세요",
    changed: "변경본",
    changedPlaceholder: "새 버전을 붙여넣으세요",
    ignoreWhitespace: "공백 무시",
    ignoreCase: "대소문자 무시",
    onlyChanged: "바뀐 줄만 보기",
    swap: "좌우 바꾸기",
    clear: "지우기",
    added: "추가된 줄",
    removed: "삭제된 줄",
    unchanged: "그대로인 줄",
    identical: "현재 설정에서는 두 버전이 같습니다.",
    differences: "차이",
    approximate: "입력이 커서 바뀐 부분을 줄 단위가 아니라 하나의 교체 블록으로 보여줍니다.",
  },
};

function normalize(line: string, ignoreWhitespace: boolean, ignoreCase: boolean) {
  let value = line;
  if (ignoreWhitespace) value = value.replace(/\s+/g, " ").trim();
  if (ignoreCase) value = value.toLowerCase();
  return value;
}

function splitLines(text: string) {
  return text === "" ? [] : text.replace(/\r\n?/g, "\n").split("\n");
}

function buildDiff(left: string[], right: string[], ignoreWhitespace: boolean, ignoreCase: boolean) {
  const a = left.map((line) => normalize(line, ignoreWhitespace, ignoreCase));
  const b = right.map((line) => normalize(line, ignoreWhitespace, ignoreCase));
  const rows: Row[] = [];
  const equal = (i: number, j: number) => rows.push({ op: "equal", text: right[j], leftNo: i + 1, rightNo: j + 1 });
  const remove = (i: number) => rows.push({ op: "remove", text: left[i], leftNo: i + 1, rightNo: null });
  const add = (j: number) => rows.push({ op: "add", text: right[j], leftNo: null, rightNo: j + 1 });

  // Matching head and tail never need the expensive comparison.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) equal(head, head++);
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const n = a.length - tail - head;
  const m = b.length - tail - head;
  const approximate = n * m > MAX_CELLS;

  if (approximate) {
    for (let i = 0; i < n; i++) remove(head + i);
    for (let j = 0; j < m; j++) add(head + j);
  } else {
    // lcs[i][j] = length of the longest common subsequence of the middle sections from i and j on.
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = a[head + i] === b[head + j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[head + i] === b[head + j]) equal(head + i++, head + j++);
      else if (lcs[i + 1][j] >= lcs[i][j + 1]) remove(head + i++);
      else add(head + j++);
    }
    while (i < n) remove(head + i++);
    while (j < m) add(head + j++);
  }

  for (let k = tail; k > 0; k--) equal(left.length - k, right.length - k);

  return { rows, approximate };
}

const MARKER: Record<Op, string> = { equal: " ", add: "+", remove: "-" };

const ROW_CLASS: Record<Op, string> = {
  equal: "bg-transparent text-tool-text-dim",
  add: "bg-emerald-500/10 text-tool-text",
  remove: "bg-rose-500/10 text-tool-text",
};

const MARKER_CLASS: Record<Op, string> = {
  equal: "text-tool-muted",
  add: "text-emerald-600 dark:text-emerald-400",
  remove: "text-rose-600 dark:text-rose-400",
};

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-tool-text-dim cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-tool-accent" />
      {children}
    </label>
  );
}

export default function DiffChecker() {
  const m = useMessages(messages);
  const [original, setOriginal] = useState("");
  const [changed, setChanged] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);

  const hasInput = original !== "" || changed !== "";

  const { rows, approximate } = useMemo(
    () => buildDiff(splitLines(original), splitLines(changed), ignoreWhitespace, ignoreCase),
    [original, changed, ignoreWhitespace, ignoreCase],
  );

  const added = rows.filter((row) => row.op === "add").length;
  const removed = rows.filter((row) => row.op === "remove").length;
  const unchanged = rows.length - added - removed;
  const visible = onlyChanged ? rows.filter((row) => row.op !== "equal") : rows;
  const unified = rows.map((row) => `${MARKER[row.op]}${row.text}`).join("\n");

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2">
        <ToolTextarea
          label={m.original}
          placeholder={m.originalPlaceholder}
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          rows={12}
          spellCheck={false}
        />
        <ToolTextarea
          label={m.changed}
          placeholder={m.changedPlaceholder}
          value={changed}
          onChange={(e) => setChanged(e.target.value)}
          rows={12}
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Checkbox checked={ignoreWhitespace} onChange={setIgnoreWhitespace}>{m.ignoreWhitespace}</Checkbox>
        <Checkbox checked={ignoreCase} onChange={setIgnoreCase}>{m.ignoreCase}</Checkbox>
        <Checkbox checked={onlyChanged} onChange={setOnlyChanged}>{m.onlyChanged}</Checkbox>
        <div className="flex gap-2 ml-auto">
          <ToolButton
            variant="secondary"
            onClick={() => {
              setOriginal(changed);
              setChanged(original);
            }}
            disabled={!hasInput}
          >
            {m.swap}
          </ToolButton>
          <ToolButton
            variant="ghost"
            onClick={() => {
              setOriginal("");
              setChanged("");
            }}
            disabled={!hasInput}
          >
            {m.clear}
          </ToolButton>
        </div>
      </div>

      {hasInput && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={m.added} value={added} accent={added > 0} />
            <StatCard label={m.removed} value={removed} accent={removed > 0} />
            <StatCard label={m.unchanged} value={unchanged} />
          </div>

          {added === 0 && removed === 0 ? (
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text-dim">{m.identical}</div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.differences}</span>
                <CopyButton text={unified} />
              </div>
              {approximate && <p className="text-xs text-tool-muted">{m.approximate}</p>}
              <div className="overflow-x-auto rounded-lg border border-tool-border bg-tool-surface">
                <table className="w-full border-collapse font-mono text-sm">
                  <tbody>
                    {visible.map((row, index) => (
                      <tr key={index} className={ROW_CLASS[row.op]}>
                        <td className="w-12 select-none border-r border-tool-border px-2 py-0.5 text-right align-top text-xs text-tool-muted">
                          {row.leftNo ?? ""}
                        </td>
                        <td className="w-12 select-none border-r border-tool-border px-2 py-0.5 text-right align-top text-xs text-tool-muted">
                          {row.rightNo ?? ""}
                        </td>
                        <td className={`w-6 select-none px-2 py-0.5 text-center align-top font-semibold ${MARKER_CLASS[row.op]}`}>
                          {MARKER[row.op]}
                        </td>
                        <td className="px-2 py-0.5 align-top whitespace-pre-wrap break-all">{row.text === "" ? " " : row.text}</td>
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
