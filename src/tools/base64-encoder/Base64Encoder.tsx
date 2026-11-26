import { useState } from "react";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";

type Mode = "encode" | "decode";

const messages = {
  en: {
    encode: "Encode",
    decode: "Decode",
    inputLabel: { encode: "Plain text", decode: "Base64 string" },
    placeholder: { encode: "Enter text to encode to Base64…", decode: "Paste a Base64 string to decode…" },
    run: { encode: "Encode →", decode: "Decode →" },
    outputLabel: { encode: "Base64 output", decode: "Decoded text" },
    error: {
      encode: "Could not encode. Check that the input is valid text.",
      decode: "Invalid Base64. Check for spaces, line breaks, or non-Base64 characters.",
    },
    swap: "⇄ Swap",
    clear: "Clear",
    chars: (n: string) => `${n} chars`,
  },
  ko: {
    encode: "인코딩",
    decode: "디코딩",
    inputLabel: { encode: "일반 텍스트", decode: "Base64 문자열" },
    placeholder: { encode: "Base64로 인코딩할 텍스트를 입력하세요…", decode: "디코딩할 Base64 문자열을 붙여넣으세요…" },
    run: { encode: "인코딩 →", decode: "디코딩 →" },
    outputLabel: { encode: "Base64 결과", decode: "디코딩된 텍스트" },
    error: {
      encode: "인코딩할 수 없습니다. 입력이 올바른 텍스트인지 확인하세요.",
      decode: "올바른 Base64가 아닙니다. 공백, 줄바꿈, Base64가 아닌 문자가 있는지 확인하세요.",
    },
    swap: "⇄ 바꾸기",
    clear: "지우기",
    chars: (n: string) => `${n}자`,
  },
};

function encodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export default function Base64Encoder() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [error, setError] = useState(false);

  function reset() {
    setOutput("");
    setError(false);
  }

  function convert() {
    reset();
    try {
      setOutput(mode === "encode" ? encodeUtf8(input) : decodeUtf8(input));
    } catch {
      setError(true);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
  }

  function swap() {
    setInput(output);
    switchMode(mode === "encode" ? "decode" : "encode");
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex gap-2">
        {(["encode", "decode"] as const).map((md) => (
          <ToolButton key={md} variant={mode === md ? "primary" : "secondary"} size="sm" onClick={() => switchMode(md)}>
            {m[md]}
          </ToolButton>
        ))}
      </div>

      <ToolTextarea
        label={m.inputLabel[mode]}
        placeholder={m.placeholder[mode]}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          reset();
        }}
        rows={7}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <ToolButton size="sm" onClick={convert} disabled={!input.trim()}>
          {m.run[mode]}
        </ToolButton>
        <ToolButton variant="ghost" size="sm" onClick={swap} disabled={!output}>
          {m.swap}
        </ToolButton>
        <ToolButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setInput("");
            reset();
          }}
          disabled={!input && !output}
        >
          {m.clear}
        </ToolButton>
      </div>

      {error && <ToolNotice>{m.error[mode]}</ToolNotice>}

      {output && (
        <div className="flex flex-col gap-2">
          <ToolTextarea label={m.outputLabel[mode]} value={output} rows={7} readOnly />
          <div className="flex gap-2">
            <CopyButton text={output} />
            <span className="text-xs text-tool-muted self-center ml-1">{m.chars(output.length.toLocaleString())}</span>
          </div>
        </div>
      )}
    </div>
  );
}
