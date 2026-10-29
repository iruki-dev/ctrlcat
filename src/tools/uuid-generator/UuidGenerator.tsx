import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

const MAX_COUNT = 500;
const HEX = "0123456789abcdef";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function"
      ? globalThis.crypto
      : null;
  if (source) {
    source.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function uuidV4(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let hex = "";
  for (let i = 0; i < 16; i += 1) {
    hex += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

interface Options {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

function format(value: string, options: Options): string {
  let out = options.hyphens ? value : value.replace(/-/g, "");
  if (options.uppercase) out = out.toUpperCase();
  if (options.braces) out = `{${out}}`;
  return out;
}

export default function UuidGenerator() {
  const [countText, setCountText] = useState("1");
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [values, setValues] = useState<string[]>([]);

  const parsed = Number.parseInt(countText, 10);
  const count = Number.isNaN(parsed) ? 0 : parsed;
  const countError =
    countText.trim() === ""
      ? ""
      : Number.isNaN(parsed) || parsed < 1
        ? "Enter a whole number of 1 or more."
        : parsed > MAX_COUNT
          ? `Maximum is ${MAX_COUNT} at a time.`
          : "";
  const canGenerate = count >= 1 && count <= MAX_COUNT;

  const options: Options = { uppercase, hyphens, braces };
  const formatted = values.map((value) => format(value, options));

  const generate = () => {
    if (!canGenerate) return;
    const next: string[] = [];
    for (let i = 0; i < count; i += 1) next.push(uuidV4());
    setValues(next);
  };

  const clear = () => {
    setValues([]);
  };

  const toggles: { label: string; hint: string; value: boolean; set: (next: boolean) => void }[] = [
    { label: "Uppercase", hint: "A-F instead of a-f", value: uppercase, set: setUppercase },
    { label: "Hyphens", hint: "Keep the four dashes", value: hyphens, set: setHyphens },
    { label: "Braces", hint: "Wrap in curly brackets", value: braces, set: setBraces },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label="How many"
          type="number"
          min={1}
          max={MAX_COUNT}
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          hint={countError || `1 to ${MAX_COUNT} identifiers per batch`}
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">Format</span>
          <div className="flex flex-col gap-2">
            {toggles.map((toggle) => (
              <label
                key={toggle.label}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-tool-border bg-tool-surface px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={toggle.value}
                  onChange={(e) => toggle.set(e.target.checked)}
                  className="h-4 w-4 accent-tool-accent"
                />
                <span className="text-sm text-tool-text">{toggle.label}</span>
                <span className="ml-auto text-xs text-tool-text-dim">{toggle.hint}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToolButton onClick={generate} disabled={!canGenerate}>
          Generate
        </ToolButton>
        <ToolButton variant="ghost" onClick={clear} disabled={values.length === 0}>
          Clear
        </ToolButton>
      </div>

      {formatted.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Generated" value={formatted.length} accent />
            <StatCard label="Length each" value={formatted[0].length} sub="characters" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">Result</span>
              <CopyButton text={formatted.join("\n")} />
            </div>
            <div className="flex max-h-96 flex-col divide-y divide-tool-border overflow-y-auto rounded-lg border border-tool-border bg-tool-surface">
              {formatted.map((value, index) => (
                <div key={`${value}-${index}`} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-10 shrink-0 text-right font-mono text-xs text-tool-text-dim">
                    {index + 1}
                  </span>
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
