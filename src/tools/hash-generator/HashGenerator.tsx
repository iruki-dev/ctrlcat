import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";
import { formatBytes } from "../lib/format";

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];
type Mode = "text" | "file";

const messages = {
  en: {
    modes: { text: "Text", file: "File" } as Record<Mode, string>,
    algorithm: "Algorithm",
    input: "Input",
    placeholder: "Type or paste text to hash…",
    file: "File",
    chooseFile: "Choose a file from your computer",
    fileStays: "The file stays on your device",
    generate: "Generate",
    working: "Working…",
    clear: "Clear",
    error: "Could not hash this input. The file may be too large for this device.",
    source: "Source",
    textInput: "Text input",
    inputSize: "Input size",
    digestLength: "Digest length",
    bits: (n: number) => `${n} bits`,
    compare: "Compare with a known value",
    comparePlaceholder: "Paste a hash to check against this result",
    compareHint: "Letter case and surrounding spaces are ignored.",
    match: "The values match.",
    noMatch: "The values do not match. Check the algorithm and the input.",
  },
  ko: {
    modes: { text: "텍스트", file: "파일" } as Record<Mode, string>,
    algorithm: "알고리즘",
    input: "입력",
    placeholder: "해시를 만들 텍스트를 입력하거나 붙여넣으세요…",
    file: "파일",
    chooseFile: "컴퓨터에서 파일 선택",
    fileStays: "파일은 기기 밖으로 나가지 않습니다",
    generate: "생성",
    working: "처리 중…",
    clear: "지우기",
    error: "이 입력의 해시를 만들 수 없습니다. 이 기기에서 처리하기에 파일이 너무 클 수 있습니다.",
    source: "원본",
    textInput: "텍스트 입력",
    inputSize: "입력 크기",
    digestLength: "해시 길이",
    bits: (n: number) => `${n}비트`,
    compare: "알고 있는 값과 비교",
    comparePlaceholder: "이 결과와 비교할 해시를 붙여넣으세요",
    compareHint: "대소문자와 앞뒤 공백은 무시합니다.",
    match: "두 값이 일치합니다.",
    noMatch: "두 값이 일치하지 않습니다. 알고리즘과 입력을 확인하세요.",
  },
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

interface Digest {
  hex: string;
  source: string | null;
  size: number;
}

export default function HashGenerator() {
  const m = useMessages(messages);
  const [mode, setMode] = useState<Mode>("text");
  const [algorithm, setAlgorithm] = useState<Algorithm>("SHA-256");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const hasInput = mode === "text" ? text !== "" : file !== null;

  const resetResult = () => {
    setDigest(null);
    setError(false);
  };

  const generate = async () => {
    resetResult();
    setBusy(true);
    try {
      const bytes = mode === "text" ? new TextEncoder().encode(text) : new Uint8Array(await file!.arrayBuffer());
      const hashed = await crypto.subtle.digest(algorithm, bytes);
      setDigest({ hex: toHex(hashed), source: mode === "file" ? file!.name : null, size: bytes.byteLength });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setText("");
    setFile(null);
    setExpected("");
    resetResult();
  };

  const normalized = expected.trim().toLowerCase();
  const matches = digest !== null && normalized === digest.hex;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {(["text", "file"] as const).map((option) => (
            <ToolButton
              key={option}
              size="sm"
              variant={mode === option ? "primary" : "ghost"}
              onClick={() => {
                setMode(option);
                resetResult();
              }}
            >
              {m.modes[option]}
            </ToolButton>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.algorithm}</span>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map((option) => (
              <ToolButton
                key={option}
                size="sm"
                variant={algorithm === option ? "secondary" : "ghost"}
                onClick={() => {
                  setAlgorithm(option);
                  resetResult();
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
          label={m.input}
          placeholder={m.placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            resetResult();
          }}
          rows={6}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.file}</span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-tool-border bg-tool-surface px-4 py-8 text-center transition-colors hover:border-tool-accent">
            <span className="text-sm text-tool-text">{file ? file.name : m.chooseFile}</span>
            <span className="text-xs text-tool-text-dim">{file ? formatBytes(file.size) : m.fileStays}</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                resetResult();
              }}
            />
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <ToolButton onClick={generate} disabled={!hasInput || busy}>
          {busy ? m.working : m.generate}
        </ToolButton>
        <ToolButton variant="ghost" onClick={clear}>
          {m.clear}
        </ToolButton>
      </div>

      {error && <ToolNotice>{m.error}</ToolNotice>}

      {digest && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{algorithm}</span>
              <CopyButton text={digest.hex} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {digest.hex}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={m.source} value={digest.source ?? m.textInput} />
            <StatCard label={m.inputSize} value={formatBytes(digest.size)} />
            <StatCard label={m.digestLength} value={m.bits(digest.hex.length * 4)} accent />
          </div>

          <div className="flex flex-col gap-2">
            <ToolInput
              label={m.compare}
              placeholder={m.comparePlaceholder}
              hint={m.compareHint}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            {normalized !== "" && (
              <ToolNotice tone={matches ? "success" : "error"}>{matches ? m.match : m.noMatch}</ToolNotice>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
