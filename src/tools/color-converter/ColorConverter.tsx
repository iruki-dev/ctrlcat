import { useState } from "react";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type RGB = [number, number, number];
type HSL = [number, number, number];

function hexToRgb(hex: string): RGB | null {
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return [f(0), f(8), f(4)];
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(s);
}

interface ChannelInputProps {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
}
function ChannelInput({ label, value, min = 0, max, onChange }: ChannelInputProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-2xs text-tool-muted mb-1 font-medium">{label}</div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-full font-mono rounded-lg border border-tool-border bg-tool-surface text-tool-text
                   px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-tool-accent focus:border-tool-accent"
      />
    </div>
  );
}

export default function ColorConverter() {
  const [hex, setHex] = useState("#0891b2");
  const [hexInput, setHexInput] = useState("#0891b2");

  const rgb = hexToRgb(hex) ?? ([0, 0, 0] as RGB);
  const hsl = rgbToHsl(...rgb);

  function applyHex(value: string) {
    setHexInput(value);
    if (isValidHex(value)) setHex(value);
  }

  function applyRgb(r: number, g: number, b: number) {
    const h = rgbToHex(r, g, b);
    setHex(h);
    setHexInput(h);
  }

  function applyHsl(h: number, s: number, l: number) {
    const newHex = rgbToHex(...hslToRgb(h, s, l));
    setHex(newHex);
    setHexInput(newHex);
  }

  const valid = isValidHex(hex);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Color swatch */}
      <div
        className="h-28 rounded-2xl border border-tool-border transition-colors duration-200 shadow-inner"
        style={{ backgroundColor: valid ? hex : "#e2e8f0" }}
      />

      {/* HEX */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-tool-muted uppercase tracking-wider">HEX</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={valid ? hex : "#000000"}
            onChange={(e) => applyHex(e.target.value)}
            className="h-10 w-12 rounded-lg border border-tool-border cursor-pointer shrink-0 p-0.5"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => applyHex(e.target.value)}
            placeholder="#000000"
            maxLength={7}
            className={`flex-1 font-mono rounded-lg border px-3 py-2 text-sm bg-tool-surface text-tool-text
                       focus:outline-none focus:ring-1 focus:ring-tool-accent transition-colors ${
                         valid ? "border-tool-border" : "border-red-300 bg-red-50"
                       }`}
          />
          {valid && <CopyButton text={hex} />}
        </div>
        {!valid && (
          <p className="text-xs text-red-500">Enter a 6-digit hex color, e.g. #ff5500</p>
        )}
      </div>

      {/* RGB */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-tool-muted uppercase tracking-wider">RGB</label>
        <div className="flex gap-2 items-end">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <ChannelInput
              key={ch}
              label={ch}
              value={rgb[i]}
              max={255}
              onChange={(v) => {
                const next: RGB = [...rgb] as RGB;
                next[i] = v;
                applyRgb(...next);
              }}
            />
          ))}
          <CopyButton text={`rgb(${rgb.join(", ")})`} />
        </div>
      </div>

      {/* HSL */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-tool-muted uppercase tracking-wider">HSL</label>
        <div className="flex gap-2 items-end">
          <ChannelInput label="H°" value={hsl[0]} max={360} onChange={(v) => applyHsl(v, hsl[1], hsl[2])} />
          <ChannelInput label="S%" value={hsl[1]} max={100} onChange={(v) => applyHsl(hsl[0], v, hsl[2])} />
          <ChannelInput label="L%" value={hsl[2]} max={100} onChange={(v) => applyHsl(hsl[0], hsl[1], v)} />
          <CopyButton text={`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`} />
        </div>
        {/* Hue strip preview */}
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
