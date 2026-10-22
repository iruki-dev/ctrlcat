import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Scheme =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split"
  | "tetradic"
  | "monochromatic";

const SCHEMES: { id: Scheme; label: string }[] = [
  { id: "complementary", label: "Complementary" },
  { id: "analogous", label: "Analogous" },
  { id: "triadic", label: "Triadic" },
  { id: "split", label: "Split complementary" },
  { id: "tetradic", label: "Tetradic" },
  { id: "monochromatic", label: "Monochromatic" },
];

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function parseHex(value: string): [number, number, number] | null {
  const match = value.trim().match(HEX_RE);
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (hn < 60) rgb = [c, x, 0];
  else if (hn < 120) rgb = [x, c, 0];
  else if (hn < 180) rgb = [0, c, x];
  else if (hn < 240) rgb = [0, x, c];
  else if (hn < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

interface Swatch {
  hex: string;
  note: string;
}

function buildPalette(
  h: number,
  s: number,
  l: number,
  scheme: Scheme,
): Swatch[] {
  if (scheme === "monochromatic") {
    const steps = [-28, -14, 0, 14, 28];
    return steps.map((step) => {
      const light = Math.min(92, Math.max(8, l + step));
      return {
        hex: hslToHex(h, s, light),
        note: step === 0 ? "Base" : `Lightness ${Math.round(light)}%`,
      };
    });
  }

  const offsetsByScheme: Record<Exclude<Scheme, "monochromatic">, number[]> = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    split: [0, 150, 210],
    tetradic: [0, 90, 180, 270],
  };

  return offsetsByScheme[scheme].map((offset) => ({
    hex: hslToHex(h + offset, s, l),
    note: offset === 0 ? "Base" : `Hue ${offset > 0 ? "+" : ""}${offset}`,
  }));
}

export default function ColorPaletteGenerator() {
  const [base, setBase] = useState("#0f766e");
  const [scheme, setScheme] = useState<Scheme>("complementary");

  const rgb = useMemo(() => parseHex(base), [base]);
  const hsl = useMemo(
    () => (rgb ? rgbToHsl(rgb[0], rgb[1], rgb[2]) : null),
    [rgb],
  );
  const palette = useMemo(
    () => (hsl ? buildPalette(hsl[0], hsl[1], hsl[2], scheme) : []),
    [hsl, scheme],
  );

  const allHex = palette.map((swatch) => swatch.hex).join("\n");
  const pickerValue = rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : "#000000";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <ToolInput
            label="Base color"
            placeholder="#0f766e"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            hint={
              rgb
                ? "Three or six hex digits, with or without the leading hash."
                : "Not a valid hex color yet. Try a value like #0f766e."
            }
          />
        </div>
        <input
          type="color"
          aria-label="Pick base color"
          value={pickerValue}
          onChange={(e) => setBase(e.target.value)}
          className="h-10 w-16 cursor-pointer border border-tool-border bg-tool-surface p-1"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          Harmony
        </span>
        <div className="flex flex-wrap gap-2">
          {SCHEMES.map((item) => (
            <ToolButton
              key={item.id}
              size="sm"
              variant={scheme === item.id ? "primary" : "secondary"}
              onClick={() => setScheme(item.id)}
            >
              {item.label}
            </ToolButton>
          ))}
        </div>
      </div>

      {rgb && hsl && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Hex" value={rgbToHex(rgb[0], rgb[1], rgb[2])} accent />
          <StatCard label="RGB" value={`${rgb[0]}, ${rgb[1]}, ${rgb[2]}`} />
          <StatCard
            label="HSL"
            value={`${Math.round(hsl[0])}, ${Math.round(hsl[1])}%, ${Math.round(hsl[2])}%`}
          />
        </div>
      )}

      {palette.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Palette
            </span>
            <CopyButton text={allHex} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {palette.map((swatch, index) => (
              <div
                key={`${swatch.hex}-${index}`}
                className="flex flex-col gap-2 rounded-lg border border-tool-border bg-tool-surface p-3"
              >
                <div
                  className="h-20 w-full rounded-md border border-tool-border"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm text-tool-text">
                    {swatch.hex}
                  </span>
                  <span className="text-xs text-tool-muted">{swatch.note}</span>
                </div>
                <CopyButton text={swatch.hex} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <ToolButton variant="ghost" onClick={() => setBase("#0f766e")}>
          Reset
        </ToolButton>
      </div>
    </div>
  );
}
