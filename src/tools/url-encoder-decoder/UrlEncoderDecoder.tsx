import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";

type Mode = "encode" | "decode";
type Scope = "component" | "full";

const messages = {
  en: {
    modes: { encode: "Encode", decode: "Decode" } as Record<Mode, string>,
    scopes: {
      component: { label: "Component", hint: "One query value or path segment" },
      full: { label: "Full URL", hint: "Keeps : / ? & = # intact" },
    } as Record<Scope, { label: string; hint: string }>,
    inputLabel: { encode: "Plain text", decode: "Encoded text" } as Record<Mode, string>,
    plusAsSpace: "Read + as a space",
    swap: "Swap",
    clear: "Clear",
    invalid: "This text is not valid percent-encoding. A % must be followed by two hex digits.",
    outputLabel: { encode: "Encoded", decode: "Decoded" } as Record<Mode, string>,
    inputLength: "Input length",
    outputLength: "Output length",
    changedLabel: { encode: "Escaped", decode: "Sequences" } as Record<Mode, string>,
    changedSub: { encode: "characters encoded", decode: "percent groups" } as Record<Mode, string>,
  },
  ko: {
    modes: { encode: "인코딩", decode: "디코딩" } as Record<Mode, string>,
    scopes: {
      component: { label: "구성 요소", hint: "쿼리 값 하나 또는 경로 조각 하나" },
      full: { label: "전체 URL", hint: ": / ? & = # 은 그대로 유지" },
    } as Record<Scope, { label: string; hint: string }>,
    inputLabel: { encode: "일반 텍스트", decode: "인코딩된 텍스트" } as Record<Mode, string>,
    plusAsSpace: "+를 공백으로 읽기",
    swap: "바꾸기",
    clear: "지우기",
    invalid: "올바른 퍼센트 인코딩이 아닙니다. % 뒤에는 16진수 두 자리가 와야 합니다.",
    outputLabel: { encode: "인코딩 결과", decode: "디코딩 결과" } as Record<Mode, string>,
    inputLength: "입력 길이",
    outputLength: "결과 길이",
    changedLabel: { encode: "변환된 문자", decode: "인코딩 묶음" } as Record<Mode, string>,
    changedSub: { encode: "개 문자 인코딩됨", decode: "개 퍼센트 묶음" } as Record<Mode, string>,
  },
};

const PLACEHOLDER: Record<Mode, string> = {
  encode: "https://example.com/search?q=hello world",
  decode: "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world",
};

function convert(text: string, mode: Mode, scope: Scope, plusAsSpace: boolean): string | null {
  try {
    if (mode === "encode") return scope === "component" ? encodeURIComponent(text) : encodeURI(text);
    const prepared = plusAsSpace ? text.replace(/\+/g, "%20") : text;
    return scope === "component" ? decodeURIComponent(prepared) : decodeURI(prepared);
  } catch {
    return null;
  }
}

function countChanged(input: string, mode: Mode, scope: Scope): number {
  if (mode === "decode") return (input.match(/%[0-9a-fA-F]{2}/g) ?? []).length;
  const encode = scope === "component" ? encodeURIComponent : encodeURI;
  return [...input].filter((char) => encode(char) !== char).length;
}

export default function UrlEncoderDecoder() {
  const m = useMessages(messages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [scope, setScope] = useState<Scope>("component");
  const [plusAsSpace, setPlusAsSpace] = useState(true);

  const output = useMemo(() => convert(input, mode, scope, plusAsSpace), [input, mode, scope, plusAsSpace]);
  const changed = useMemo(() => countChanged(input, mode, scope), [input, mode, scope]);

  const swap = () => {
    if (!output) return;
    setInput(output);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        {(["encode", "decode"] as const).map((id) => (
          <ToolButton key={id} size="sm" variant={mode === id ? "primary" : "secondary"} onClick={() => setMode(id)}>
            {m.modes[id]}
          </ToolButton>
        ))}
        <span className="mx-1 h-6 w-px bg-tool-border" />
        {(["component", "full"] as const).map((id) => (
          <ToolButton
            key={id}
            size="sm"
            variant={scope === id ? "primary" : "secondary"}
            onClick={() => setScope(id)}
            title={m.scopes[id].hint}
          >
            {m.scopes[id].label}
          </ToolButton>
        ))}
      </div>

      <p className="-mt-3 text-xs text-tool-muted">{m.scopes[scope].hint}</p>

      <ToolTextarea
        label={m.inputLabel[mode]}
        placeholder={PLACEHOLDER[mode]}
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
          {m.plusAsSpace}
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <ToolButton variant="secondary" onClick={swap} disabled={!output}>
          {m.swap}
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setInput("")} disabled={input === ""}>
          {m.clear}
        </ToolButton>
      </div>

      {output === null && <ToolNotice>{m.invalid}</ToolNotice>}

      {output && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.outputLabel[mode]}</span>
              <CopyButton text={output} />
            </div>
            <div className="rounded-lg border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {output}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={m.inputLength} value={input.length} />
            <StatCard label={m.outputLength} value={output.length} />
            <StatCard label={m.changedLabel[mode]} value={changed} sub={m.changedSub[mode]} accent />
          </div>
        </>
      )}
    </div>
  );
}
