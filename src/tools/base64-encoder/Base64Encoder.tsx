import { useState } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Mode = "encode" | "decode";

export default function Base64Encoder() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [error, setError] = useState("");

  function convert() {
    setError("");
    if (!input.trim()) return;
    try {
      if (mode === "encode") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input.trim()))));
      }
    } catch {
      setError(
        mode === "encode"
          ? "Could not encode — check input contains valid text."
          : "Invalid Base64 — check for spaces, line breaks, or non-Base64 characters."
      );
      setOutput("");
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setOutput("");
  }

  function swap() {
    if (!output) return;
    setInput(output);
    setOutput("");
    setError("");
    switchMode(mode === "encode" ? "decode" : "encode");
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Mode selector */}
      <div className="flex gap-2">
        <ToolButton
          variant={mode === "encode" ? "primary" : "secondary"}
          size="sm"
          onClick={() => switchMode("encode")}
        >
          Encode
        </ToolButton>
        <ToolButton
          variant={mode === "decode" ? "primary" : "secondary"}
          size="sm"
          onClick={() => switchMode("decode")}
        >
          Decode
        </ToolButton>
      </div>

      <ToolTextarea
        label={mode === "encode" ? "Plain text" : "Base64 string"}
        placeholder={
          mode === "encode"
            ? "Enter text to encode to Base64…"
            : "Paste a Base64 string to decode…"
        }
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(""); setOutput(""); }}
        rows={7}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <ToolButton size="sm" onClick={convert} disabled={!input.trim()}>
          {mode === "encode" ? "Encode →" : "Decode →"}
        </ToolButton>
        <ToolButton
          variant="ghost"
          size="sm"
          onClick={swap}
          disabled={!output}
        >
          ⇄ Swap
        </ToolButton>
        <ToolButton
          variant="ghost"
          size="sm"
          onClick={() => { setInput(""); setOutput(""); setError(""); }}
          disabled={!input && !output}
        >
          Clear
        </ToolButton>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {output && (
        <div className="flex flex-col gap-2">
          <ToolTextarea
            label={mode === "encode" ? "Base64 output" : "Decoded text"}
            value={output}
            onChange={() => {}}
            rows={7}
            readOnly
          />
          <div className="flex gap-2">
            <CopyButton text={output} />
            <span className="text-xs text-tool-muted self-center ml-1">
              {output.length.toLocaleString()} chars
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
