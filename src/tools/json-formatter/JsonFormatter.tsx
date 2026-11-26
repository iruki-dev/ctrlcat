import { useState } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";

const messages = {
  en: {
    inputLabel: "JSON input",
    outputLabel: "Output",
    outputPlaceholder: "Formatted output will appear here…",
    format: "Format",
    minify: "Minify",
    validate: "Validate",
    indent: "Indent:",
    valid: "✓ Valid JSON",
    invalid: "Invalid JSON",
  },
  ko: {
    inputLabel: "JSON 입력",
    outputLabel: "결과",
    outputPlaceholder: "정리된 결과가 여기에 표시됩니다…",
    format: "정렬",
    minify: "압축",
    validate: "검사",
    indent: "들여쓰기:",
    valid: "✓ 올바른 JSON입니다",
    invalid: "올바른 JSON이 아닙니다",
  },
};

type Result = { ok: true; value: unknown } | { ok: false; error: string };

export default function JsonFormatter() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [indent, setIndent] = useState(2);

  function parse(): Result {
    try {
      return { ok: true, value: JSON.parse(input) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? `${m.invalid}: ${e.message}` : m.invalid };
    }
  }

  function run(space: number | undefined) {
    const result = parse();
    if (result.ok) {
      setOutput(JSON.stringify(result.value, null, space));
      setNotice(null);
    } else {
      setOutput("");
      setNotice({ text: result.error, ok: false });
    }
  }

  function validate() {
    const result = parse();
    setOutput("");
    setNotice(result.ok ? { text: m.valid, ok: true } : { text: result.error, ok: false });
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToolTextarea
          label={m.inputLabel}
          placeholder={'{\n  "key": "value",\n  "number": 42\n}'}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setNotice(null);
            setOutput("");
          }}
          rows={14}
        />
        <ToolTextarea
          label={m.outputLabel}
          value={output}
          readOnly
          rows={14}
          placeholder={m.outputPlaceholder}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ToolButton size="sm" onClick={() => run(indent)} disabled={!input.trim()}>
          {m.format}
        </ToolButton>
        <ToolButton variant="secondary" size="sm" onClick={() => run(undefined)} disabled={!input.trim()}>
          {m.minify}
        </ToolButton>
        <ToolButton variant="ghost" size="sm" onClick={validate} disabled={!input.trim()}>
          {m.validate}
        </ToolButton>

        <div className="flex items-center gap-1.5 ml-3 text-xs text-tool-muted">
          <span>{m.indent}</span>
          {[2, 4].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={indent === n}
              onClick={() => setIndent(n)}
              className={`w-6 h-6 rounded text-xs font-mono transition-colors ${
                indent === n
                  ? "bg-tool-accent text-tool-on-accent"
                  : "bg-tool-surface border border-tool-border text-tool-muted hover:text-tool-text"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {output && (
          <div className="ml-auto">
            <CopyButton text={output} />
          </div>
        )}
      </div>

      {notice && <ToolNotice tone={notice.ok ? "success" : "error"}>{notice.text}</ToolNotice>}
    </div>
  );
}
