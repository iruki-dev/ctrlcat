import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];

type Mode = "text" | "file";

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export default function HashGenerator() {
  const [mode, setMode] = useState<Mode>("text");
  const [algorithm, setAlgorithm] = useState<Algorithm>("SHA-256");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState("");
  const [source, setSource] = useState("");
  const [sourceSize, setSourceSize] = useState(0);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasInput = mode === "text" ? text !== "" : file !== null;

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      let bytes: Uint8Array;
      if (mode === "text") {
        bytes = new TextEncoder().encode(text);
        setSource("Text input");
      } else {
        if (!file) return;
        bytes = new Uint8Array(await file.arrayBuffer());
        setSource(file.name);
      }
      const hashed = await crypto.subtle.digest(
        algorithm,
        bytes.buffer as ArrayBuffer,
      );
      setDigest(toHex(hashed));
      setSourceSize(bytes.byteLength);
    } catch {
      setDigest("");
      setSourceSize(0);
      setError("Could not hash this input. The file may be too large for this device.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setText("");
    setFile(null);
    setDigest("");
    setSource("");
    setSourceSize(0);
    setExpected("");
    setError("");
  };

  const normalized = expected.trim().toLowerCase();
  const matches = normalized !== "" && digest !== "" && normalized === digest;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["text", "file"] as Mode[]).map((option) => (
            <ToolButton
              key={option}
              size="sm"
              variant={mode === option ? "primary" : "ghost"}
              onClick={() => {
                setMode(option);
                setDigest("");
                setSource("");
                setSourceSize(0);
                setError("");
              }}
            >
              {option === "text" ? "Text" : "File"}
            </ToolButton>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
            Algorithm
          </span>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map((option) => (
              <ToolButton
                key={option}
                size="sm"
                variant={algorithm === option ? "secondary" : "ghost"}
                onClick={() => {
                  setAlgorithm(option);
                  setDigest("");
                  setError("");
                }}
              >
                {option}
              </ToolButton>
            ))}
          </div>
        </div>
      </div>

      {mode === "text" ? (
        <ToolTextarea
          label="Input"
          placeholder="Type or paste text to hash…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDigest("");
          }}
          rows={6}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
            File
          </span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-tool-border bg-tool-surface px-4 py-8 text-center transition-colors hover:border-tool-accent">
            <span className="text-sm text-tool-text">
              {file ? file.name : "Choose a file from your computer"}
            </span>
            <span className="text-xs text-tool-dim">
              {file ? formatBytes(file.size) : "The file stays on your device"}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setDigest("");
                setError("");
              }}
            />
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <ToolButton onClick={generate} disabled={!hasInput || busy}>
          {busy ? "Working…" : "Generate"}
        </ToolButton>
        <ToolButton variant="ghost" onClick={clear}>
          Clear
        </ToolButton>
      </div>

      {error && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text">
          {error}
        </div>
      )}

      {digest && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                {algorithm}
              </span>
              <CopyButton text={digest} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {digest}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Source" value={source} />
            <StatCard label="Input size" value={formatBytes(sourceSize)} />
            <StatCard label="Digest length" value={`${digest.length * 4} bits`} accent />
          </div>

          <div className="flex flex-col gap-2">
            <ToolInput
              label="Compare with a known value"
              placeholder="Paste a hash to check against this result"
              hint="Letter case and surrounding spaces are ignored."
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            {normalized !== "" && (
              <div
                className={`rounded-lg border border-tool-border bg-tool-surface p-3 text-sm ${
                  matches ? "text-tool-accent" : "text-tool-text"
                }`}
              >
                {matches
                  ? "The values match."
                  : "The values do not match. Check the algorithm and the input."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
