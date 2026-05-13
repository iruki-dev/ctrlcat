import { useState } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [indent, setIndent] = useState(2);

  function parse() {
    try {
      return { ok: true, value: JSON.parse(input) };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }

  function format() {
    const result = parse();
    if (!result.ok) {
      setMessage({ text: result.error!, ok: false });
      setOutput("");
    } else {
      setOutput(JSON.stringify(result.value, null, indent));
      setMessage(null);
    }
  }

  function minify() {
    const result = parse();
    if (!result.ok) {
      setMessage({ text: result.error!, ok: false });
      setOutput("");
    } else {
      setOutput(JSON.stringify(result.value));
      setMessage(null);
    }
  }

  function validate() {
    const result = parse();
    setMessage(
      result.ok
        ? { text: "✓ Valid JSON", ok: true }
        : { text: result.error!, ok: false }
    );
    setOutput("");
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToolTextarea
          label="JSON input"
          placeholder={'{\n  "key": "value",\n  "number": 42\n}'}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setMessage(null);
            setOutput("");
          }}
          rows={14}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-tool-text-dim uppercase tracking-wider">
            Output
          </label>
          <textarea
            value={output}
            readOnly
            rows={14}
            placeholder="Formatted output will appear here…"
            className="w-full bg-tool-bg border border-tool-border rounded-lg px-3 py-2.5 text-tool-text
                       text-sm font-mono resize-none placeholder:text-tool-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ToolButton size="sm" onClick={format} disabled={!input.trim()}>
          Format
        </ToolButton>
        <ToolButton variant="secondary" size="sm" onClick={minify} disabled={!input.trim()}>
          Minify
        </ToolButton>
        <ToolButton variant="ghost" size="sm" onClick={validate} disabled={!input.trim()}>
          Validate
        </ToolButton>

        <div className="flex items-center gap-1.5 ml-3 text-xs text-tool-muted">
          <span>Indent:</span>
          {[2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setIndent(n)}
              className={`w-6 h-6 rounded text-xs font-mono transition-colors ${
                indent === n
                  ? "bg-tool-accent text-white"
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

      {message && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            message.ok
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
