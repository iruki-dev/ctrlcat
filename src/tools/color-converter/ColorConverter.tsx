import { useState } from "react";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";
import { normalizeHex, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, type RGB, type HSL } from "../lib/color";

const DEFAULT_HEX = "#0891b2";

const messages = {
  en: { pick: "Pick a color", invalidHex: "Enter a 6-digit hex color, e.g. #ff5500" },
  ko: { pick: "색상 선택", invalidHex: "6자리 헥스 색상을 입력하세요. 예: #ff5500" },
};

function ChannelInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex-1 min-w-0">
      <div className="text-2xs text-tool-muted mb-1 font-medium">{label}</div>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(0, Math.min(max, v)));
        }}
        className="w-full font-mono rounded-lg border border-tool-border bg-tool-surface text-tool-text
                   px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-tool-accent focus:border-tool-accent"
      />
    </label>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="text-xs font-medium text-tool-muted uppercase tracking-wider">{children}</div>;
}

export default function ColorConverter() {
  const m = useMessages(messages);
  const [hex, setHex] = useState(DEFAULT_HEX);
  const [hexInput, setHexInput] = useState(DEFAULT_HEX);

  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb).map(Math.round) as HSL;
  const inputValid = normalizeHex(hexInput) !== null;

  function applyHexInput(value: string) {
    setHexInput(value);
    const normalized = normalizeHex(value);
    if (normalized) setHex(normalized);
  }

  function apply(next: string) {
    setHex(next);
    setHexInput(next);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div
        className="h-28 rounded-2xl border border-tool-border transition-colors duration-200 shadow-inner"
        style={{ backgroundColor: hex }}
      />

      <div className="flex flex-col gap-2">
        <SectionLabel>HEX</SectionLabel>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            aria-label={m.pick}
            value={hex}
            onChange={(e) => apply(e.target.value)}
            className="h-10 w-12 rounded-lg border border-tool-border cursor-pointer shrink-0 p-0.5"
          />
          <input
            type="text"
            aria-label="HEX"
            aria-invalid={!inputValid}
            value={hexInput}
            onChange={(e) => applyHexInput(e.target.value)}
            placeholder="#000000"
            maxLength={7}
            className={`flex-1 font-mono rounded-lg border px-3 py-2 text-sm bg-tool-surface text-tool-text
                       focus:outline-none focus:ring-1 focus:ring-tool-accent transition-colors ${
                         inputValid ? "border-tool-border" : "border-red-400 dark:border-red-700"
                       }`}
          />
          <CopyButton text={hex} />
        </div>
        {!inputValid && <p className="text-xs text-red-600 dark:text-red-400">{m.invalidHex}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>RGB</SectionLabel>
        <div className="flex gap-2 items-end">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <ChannelInput
              key={ch}
              label={ch}
              value={rgb[i]}
              max={255}
              onChange={(v) => {
                const next = [...rgb] as RGB;
                next[i] = v;
                apply(rgbToHex(next));
              }}
            />
          ))}
          <CopyButton text={`rgb(${rgb.join(", ")})`} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>HSL</SectionLabel>
        <div className="flex gap-2 items-end">
          {(["H°", "S%", "L%"] as const).map((ch, i) => (
            <ChannelInput
              key={ch}
              label={ch}
              value={hsl[i]}
              max={i === 0 ? 360 : 100}
              onChange={(v) => {
                const next = [...hsl] as HSL;
                next[i] = v;
                apply(rgbToHex(hslToRgb(next)));
              }}
            />
          ))}
          <CopyButton text={`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`} />
        </div>
        <div
          className="h-3 rounded-full mt-1 border border-tool-border"
          style={{
            background:
              "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
          }}
        />
      </div>
    </div>
  );
}
