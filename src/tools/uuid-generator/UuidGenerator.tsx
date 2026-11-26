import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

const MAX_COUNT = 500;

type OptionKey = "uppercase" | "hyphens" | "braces";
type Options = Record<OptionKey, boolean>;

const messages = {
  en: {
    howMany: "How many",
    countError: "Enter a whole number of 1 or more.",
    maxError: (max: number) => `Maximum is ${max} at a time.`,
    countHint: (max: number) => `1 to ${max} identifiers per batch`,
    format: "Format",
    options: {
      uppercase: { label: "Uppercase", hint: "A-F instead of a-f" },
      hyphens: { label: "Hyphens", hint: "Keep the four dashes" },
      braces: { label: "Braces", hint: "Wrap in curly brackets" },
    } as Record<OptionKey, { label: string; hint: string }>,
    generate: "Generate",
    clear: "Clear",
    generated: "Generated",
    lengthEach: "Length each",
    characters: "characters",
    result: "Result",
  },
  ko: {
    howMany: "개수",
    countError: "1 이상의 정수를 입력하세요.",
    maxError: (max: number) => `한 번에 최대 ${max}개까지 만들 수 있습니다.`,
    countHint: (max: number) => `한 번에 1~${max}개`,
    format: "형식",
    options: {
      uppercase: { label: "대문자", hint: "a-f 대신 A-F" },
      hyphens: { label: "하이픈", hint: "네 개의 대시 유지" },
      braces: { label: "중괄호", hint: "중괄호로 감싸기" },
    } as Record<OptionKey, { label: string; hint: string }>,
    generate: "생성",
    clear: "지우기",
    generated: "생성된 개수",
    lengthEach: "개당 길이",
    characters: "글자",
    result: "결과",
  },
};

function uuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function format(value: string, o: Options): string {
  let out = o.hyphens ? value : value.replace(/-/g, "");
  if (o.uppercase) out = out.toUpperCase();
  return o.braces ? `{${out}}` : out;
}

export default function UuidGenerator() {
  const m = useMessages(messages);
  const [countText, setCountText] = useState("1");
  const [options, setOptions] = useState<Options>({ uppercase: false, hyphens: true, braces: false });
  const [values, setValues] = useState<string[]>([]);

  const parsed = Number.parseInt(countText, 10);
  const countError =
    countText.trim() === ""
      ? ""
      : Number.isNaN(parsed) || parsed < 1
        ? m.countError
        : parsed > MAX_COUNT
          ? m.maxError(MAX_COUNT)
          : "";
  const canGenerate = parsed >= 1 && parsed <= MAX_COUNT;
  const formatted = values.map((value) => format(value, options));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label={m.howMany}
          type="number"
          min={1}
          max={MAX_COUNT}
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          hint={countError || m.countHint(MAX_COUNT)}
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.format}</span>
          <div className="flex flex-col gap-2">
            {(Object.keys(options) as OptionKey[]).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-tool-border bg-tool-surface px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-tool-accent"
                />
                <span className="text-sm text-tool-text">{m.options[key].label}</span>
                <span className="ml-auto text-xs text-tool-text-dim">{m.options[key].hint}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToolButton onClick={() => setValues(Array.from({ length: parsed }, uuidV4))} disabled={!canGenerate}>
          {m.generate}
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setValues([])} disabled={values.length === 0}>
          {m.clear}
        </ToolButton>
      </div>

      {formatted.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label={m.generated} value={formatted.length} accent />
            <StatCard label={m.lengthEach} value={formatted[0].length} sub={m.characters} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.result}</span>
              <CopyButton text={formatted.join("\n")} />
            </div>
            <div className="flex max-h-96 flex-col divide-y divide-tool-border overflow-y-auto rounded-lg border border-tool-border bg-tool-surface">
              {formatted.map((value, index) => (
                <div key={values[index]} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-tool-text-dim">{index + 1}</span>
                  <span className="flex-1 break-all font-mono text-sm text-tool-text">{value}</span>
                  <CopyButton text={value} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
