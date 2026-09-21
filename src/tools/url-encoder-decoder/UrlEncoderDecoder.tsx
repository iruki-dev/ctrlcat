import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Mode = "encode" | "decode";
type Scope = "component" | "full";

type Result = { ok: true; value: string } | { ok: false; error: string };

function convert(
  text: string,
  mode: Mode,
  scope: Scope,
  plusAsSpace: boolean,
): Result {
  if (text === "") return { ok: true, value: "" };

  try {
    if (mode === "encode") {
      return {
        ok: true,
        value:
          scope === "component"
            ? encodeURIComponent(text)
            : encodeURI(text),
      };
    }

    const prepared = plusAsSpace ? text.replace(/\+/g, "%20") : text;
    return {
      ok: true,
      value:
        scope === "component"
          ? decodeURIComponent(prepared)
          : decodeURI(prepared),
    };
  } catch {
    return {
      ok: false,
      error:
        "This text is not valid percent-encoding. A % must be followed by two hex digits.",
    };
  }
}

const modes: { id: Mode; label: string }[] = [
  { id: "encode", label: "Encode" },
  { id: "decode", label: "Decode" },
];

const scopes: { id: Scope; label: string; hint: string }[] = [
  { id: "component", label: "Component", hint: "One query value or path segment" },
  { id: "full", label: "Full URL", hint: "Keeps : / ? & = # intact" },
];

export default function UrlEncoderDecoder() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [scope, setScope] = useState<Scope>("component");
  const [plusAsSpace, setPlusAsSpace] = useState(true);

  const result = useMemo(
    () => convert(input, mode, scope, plusAsSpace),
    [input, mode, scope, plusAsSpace],
  );

  const output = result.ok ? result.value : "";

  const changed = useMemo(() => {
    if (!result.ok || input === "") return 0;
    if (mode === "decode") {
      return (input.match(/%[0-9a-fA-F]{2}/g) ?? []).length;
    }
    let count = 0;
    for (const char of input) {
      const encoded =
        scope === "component" ? encodeURIComponent(char) : encodeURI(char);
      if (encoded !== char) count += 1;
    }
    return count;
  }, [input, mode, scope, result.ok]);

  const swap = () => {
    if (!result.ok || result.value === "") return;
    setInput(result.value);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <ToolButton
            key={m.id}
            size="sm"
            variant={mode === m.id ? "primary" : "secondary"}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </ToolButton>
        ))}
        <span className="mx-1 h-6 w-px bg-tool-border" />
        {scopes.map((s) => (
          <ToolButton
            key={s.id}
            size="sm"
            variant={scope === s.id ? "primary" : "secondary"}
            onClick={() => setScope(s.id)}
            title={s.hint}
          >
            {s.label}
          </ToolButton>
        ))}
      </div>

      <p className="-mt-3 text-xs text-tool-muted">
        {scopes.find((s) => s.id === scope)?.hint}
      </p>

      <ToolTextarea
        label={mode === "encode" ? "Plain text" : "Encoded text"}
        placeholder={
          mode === "encode"
            ? "https://example.com/search?q=hello world"
            : "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        spellCheck={false}
      />

      {mode === "decode" && (
        <label className="-mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-tool-text-dim">
          <input
            type="checkbox"
            checked={plusAsSpace}
            onChange={(e) => setPlusAsSpace(e.target.checked)}
            className="h-4 w-4 accent-tool-accent"
          />
          Read + as a space
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <ToolButton
          variant="secondary"
          onClick={swap}
          disabled={!result.ok || output === ""}
        >
          Swap
        </ToolButton>
        <ToolButton
          variant="ghost"
          onClick={() => setInput("")}
          disabled={input === ""}
        >
          Clear
        </ToolButton>
      </div>

      {!result.ok && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text">
          {result.error}
        </div>
      )}

      {result.ok && output !== "" && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                {mode === "encode" ? "Encoded" : "Decoded"}
              </span>
              <CopyButton text={output} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {output}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Input length" value={input.length} />
            <StatCard label="Output length" value={output.length} />
            <StatCard
              label={mode === "encode" ? "Escaped" : "Sequences"}
              value={changed}
              sub={mode === "encode" ? "characters encoded" : "percent groups"}
              accent
            />
          </div>
        </>
      )}
    </div>
  );
}
