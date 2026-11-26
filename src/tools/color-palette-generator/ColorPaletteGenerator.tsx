import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";
import { normalizeHex, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, type HSL } from "../lib/color";

type Scheme = "complementary" | "analogous" | "triadic" | "split" | "tetradic" | "monochromatic";
const SCHEMES: Scheme[] = ["complementary", "analogous", "triadic", "split", "tetradic", "monochromatic"];
const DEFAULT_BASE = "#0f766e";

const HUE_OFFSETS: Record<Exclude<Scheme, "monochromatic">, number[]> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};
const LIGHTNESS_STEPS = [-28, -14, 0, 14, 28];

const messages = {
  en: {
    baseColor: "Base color",
    validHint: "Three or six hex digits, with or without the leading hash.",
    invalidHint: "Not a valid hex color yet. Try a value like #0f766e.",
    pick: "Pick base color",
    harmony: "Harmony",
    schemes: {
      complementary: "Complementary",
      analogous: "Analogous",
      triadic: "Triadic",
      split: "Split complementary",
      tetradic: "Tetradic",
      monochromatic: "Monochromatic",
    } as Record<Scheme, string>,
    palette: "Palette",
    base: "Base",
    lightness: (n: number) => `Lightness ${n}%`,
    hue: (offset: number) => `Hue ${offset > 0 ? "+" : ""}${offset}`,
    reset: "Reset",
  },
  ko: {
    baseColor: "기준 색상",
    validHint: "헥스 3자리 또는 6자리, 앞의 #은 있어도 없어도 됩니다.",
    invalidHint: "아직 올바른 헥스 색상이 아닙니다. #0f766e 같은 값을 입력해 보세요.",
    pick: "기준 색상 선택",
    harmony: "조화 규칙",
    schemes: {
      complementary: "보색",
      analogous: "유사색",
      triadic: "삼각 배색",
      split: "분할 보색",
      tetradic: "사각 배색",
      monochromatic: "단색 배색",
    } as Record<Scheme, string>,
    palette: "팔레트",
    base: "기준",
    lightness: (n: number) => `명도 ${n}%`,
    hue: (offset: number) => `색상 ${offset > 0 ? "+" : ""}${offset}`,
    reset: "초기화",
  },
};

type Note = { kind: "base" } | { kind: "lightness"; value: number } | { kind: "hue"; offset: number };

function buildPalette([h, s, l]: HSL, scheme: Scheme): { hex: string; note: Note }[] {
  if (scheme === "monochromatic") {
    return LIGHTNESS_STEPS.map((step) => {
      const light = Math.min(92, Math.max(8, l + step));
      return {
        hex: rgbToHex(hslToRgb([h, s, light])),
        note: step === 0 ? { kind: "base" } : { kind: "lightness", value: Math.round(light) },
      };
    });
  }
  return HUE_OFFSETS[scheme].map((offset) => ({
    hex: rgbToHex(hslToRgb([h + offset, s, l])),
    note: offset === 0 ? { kind: "base" } : { kind: "hue", offset },
  }));
}

export default function ColorPaletteGenerator() {
  const m = useMessages(messages);
  const [base, setBase] = useState(DEFAULT_BASE);
  const [scheme, setScheme] = useState<Scheme>("complementary");

  const hex = normalizeHex(base);
  const rgb = hex ? hexToRgb(hex) : null;
  const hsl = rgb ? rgbToHsl(rgb) : null;
  const palette = hsl ? buildPalette(hsl, scheme) : [];

  const noteText = (note: Note) =>
    note.kind === "base" ? m.base : note.kind === "lightness" ? m.lightness(note.value) : m.hue(note.offset);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <ToolInput
            label={m.baseColor}
            placeholder={DEFAULT_BASE}
            value={base}
            onChange={(e) => setBase(e.target.value)}
            hint={hex ? m.validHint : m.invalidHint}
          />
        </div>
        <input
          type="color"
          aria-label={m.pick}
          value={hex ?? "#000000"}
          onChange={(e) => setBase(e.target.value)}
          className="h-10 w-16 cursor-pointer border border-tool-border bg-tool-surface p-1"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">{m.harmony}</span>
        <div className="flex flex-wrap gap-2">
          {SCHEMES.map((id) => (
            <ToolButton key={id} size="sm" variant={scheme === id ? "primary" : "secondary"} onClick={() => setScheme(id)}>
              {m.schemes[id]}
            </ToolButton>
          ))}
        </div>
      </div>

      {hex && rgb && hsl && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Hex" value={hex} accent />
          <StatCard label="RGB" value={rgb.join(", ")} />
          <StatCard label="HSL" value={`${Math.round(hsl[0])}, ${Math.round(hsl[1])}%, ${Math.round(hsl[2])}%`} />
        </div>
      )}

      {palette.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.palette}</span>
            <CopyButton text={palette.map((swatch) => swatch.hex).join("\n")} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {palette.map((swatch, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg border border-tool-border bg-tool-surface p-3">
                <div className="h-20 w-full rounded-md border border-tool-border" style={{ backgroundColor: swatch.hex }} />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm text-tool-text">{swatch.hex}</span>
                  <span className="text-xs text-tool-muted">{noteText(swatch.note)}</span>
                </div>
                <CopyButton text={swatch.hex} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <ToolButton variant="ghost" onClick={() => setBase(DEFAULT_BASE)}>
          {m.reset}
        </ToolButton>
      </div>
    </div>
  );
}
