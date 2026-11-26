import { useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

type FamilyId = "length" | "weight" | "volume" | "temperature";
interface Unit {
  id: string;
  short: string;
  /** How many base units one of this unit is worth. Unused for temperature. */
  factor: number;
}

const FAMILIES: Record<FamilyId, Unit[]> = {
  length: [
    { id: "mm", short: "mm", factor: 0.001 },
    { id: "cm", short: "cm", factor: 0.01 },
    { id: "m", short: "m", factor: 1 },
    { id: "km", short: "km", factor: 1000 },
    { id: "in", short: "in", factor: 0.0254 },
    { id: "ft", short: "ft", factor: 0.3048 },
    { id: "yd", short: "yd", factor: 0.9144 },
    { id: "mi", short: "mi", factor: 1609.344 },
    { id: "nmi", short: "nmi", factor: 1852 },
  ],
  weight: [
    { id: "mg", short: "mg", factor: 0.001 },
    { id: "g", short: "g", factor: 1 },
    { id: "kg", short: "kg", factor: 1000 },
    { id: "t", short: "t", factor: 1_000_000 },
    { id: "oz", short: "oz", factor: 28.349523125 },
    { id: "lb", short: "lb", factor: 453.59237 },
    { id: "st", short: "st", factor: 6350.29318 },
  ],
  volume: [
    { id: "ml", short: "ml", factor: 0.001 },
    { id: "l", short: "L", factor: 1 },
    { id: "tsp", short: "tsp", factor: 0.00492892159375 },
    { id: "tbsp", short: "tbsp", factor: 0.01478676478125 },
    { id: "floz", short: "fl oz", factor: 0.0295735295625 },
    { id: "cup", short: "cup", factor: 0.2365882365 },
    { id: "pt", short: "pt", factor: 0.473176473 },
    { id: "qt", short: "qt", factor: 0.946352946 },
    { id: "gal", short: "gal", factor: 3.785411784 },
    { id: "impfloz", short: "fl oz UK", factor: 0.0284130625 },
    { id: "imppt", short: "pt UK", factor: 0.56826125 },
    { id: "impgal", short: "gal UK", factor: 4.54609 },
  ],
  temperature: [
    { id: "c", short: "°C", factor: 1 },
    { id: "f", short: "°F", factor: 1 },
    { id: "k", short: "K", factor: 1 },
  ],
};

const DEFAULTS: Record<FamilyId, [string, string]> = {
  length: ["cm", "in"],
  weight: ["kg", "lb"],
  volume: ["l", "gal"],
  temperature: ["c", "f"],
};

const messages = {
  en: {
    families: { length: "Length", weight: "Weight", volume: "Volume", temperature: "Temperature" } as Record<FamilyId, string>,
    units: {
      mm: "Millimeter", cm: "Centimeter", m: "Meter", km: "Kilometer", in: "Inch", ft: "Foot", yd: "Yard", mi: "Mile", nmi: "Nautical mile",
      mg: "Milligram", g: "Gram", kg: "Kilogram", t: "Metric ton", oz: "Ounce", lb: "Pound", st: "Stone",
      ml: "Milliliter", l: "Liter", tsp: "Teaspoon (US)", tbsp: "Tablespoon (US)", floz: "Fluid ounce (US)", cup: "Cup (US)",
      pt: "Pint (US)", qt: "Quart (US)", gal: "Gallon (US)", impfloz: "Fluid ounce (UK)", imppt: "Pint (UK)", impgal: "Gallon (UK)",
      c: "Celsius", f: "Fahrenheit", k: "Kelvin",
    } as Record<string, string>,
    amount: "Amount",
    amountPlaceholder: "Enter a number",
    from: "From",
    to: "To",
    swap: "Swap units",
    reset: "Reset",
    result: "Result",
    equals: (v: string) => `${v} equals`,
    everyUnit: (family: string) => `Every ${family.toLowerCase()} unit`,
    enterNumber: "Enter a number above to see the converted value.",
  },
  ko: {
    families: { length: "길이", weight: "무게", volume: "부피", temperature: "온도" } as Record<FamilyId, string>,
    units: {
      mm: "밀리미터", cm: "센티미터", m: "미터", km: "킬로미터", in: "인치", ft: "피트", yd: "야드", mi: "마일", nmi: "해리",
      mg: "밀리그램", g: "그램", kg: "킬로그램", t: "톤", oz: "온스", lb: "파운드", st: "스톤",
      ml: "밀리리터", l: "리터", tsp: "티스푼 (미국)", tbsp: "테이블스푼 (미국)", floz: "액량 온스 (미국)", cup: "컵 (미국)",
      pt: "파인트 (미국)", qt: "쿼트 (미국)", gal: "갤런 (미국)", impfloz: "액량 온스 (영국)", imppt: "파인트 (영국)", impgal: "갤런 (영국)",
      c: "섭씨", f: "화씨", k: "켈빈",
    } as Record<string, string>,
    amount: "값",
    amountPlaceholder: "숫자를 입력하세요",
    from: "변환할 단위",
    to: "변환될 단위",
    swap: "단위 바꾸기",
    reset: "초기화",
    result: "결과",
    equals: (v: string) => `${v}는`,
    everyUnit: (family: string) => `모든 ${family} 단위`,
    enterNumber: "위에 숫자를 입력하면 변환 결과가 표시됩니다.",
  },
};

/* Temperature needs offsets, so it is converted through Celsius instead of a factor. */
function toCelsius(value: number, unit: string): number {
  if (unit === "f") return (value - 32) / 1.8;
  if (unit === "k") return value - 273.15;
  return value;
}

function fromCelsius(value: number, unit: string): number {
  if (unit === "f") return value * 1.8 + 32;
  if (unit === "k") return value + 273.15;
  return value;
}

function convert(value: number, familyId: FamilyId, from: Unit, to: Unit): number {
  if (familyId === "temperature") return fromCelsius(toCelsius(value, from.id), to.id);
  return (value * from.factor) / to.factor;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return value.toExponential(6);
  return Number(value.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

const SELECT_CLASS =
  "h-10 w-full rounded-none border border-tool-border bg-tool-surface px-3 text-sm text-tool-text focus:outline-none focus:border-tool-accent";

export default function UnitConverter() {
  const m = useMessages(messages);
  const [familyId, setFamilyId] = useState<FamilyId>("length");
  const [amount, setAmount] = useState("1");
  const [fromId, setFromId] = useState(DEFAULTS.length[0]);
  const [toId, setToId] = useState(DEFAULTS.length[1]);

  const units = FAMILIES[familyId];
  const from = units.find((u) => u.id === fromId) ?? units[0];
  const to = units.find((u) => u.id === toId) ?? units[1];

  const parsed = amount.trim() === "" ? NaN : Number(amount);
  const valid = Number.isFinite(parsed);
  const resultLine = valid ? `${format(convert(parsed, familyId, from, to))} ${to.short}` : "";

  const pickFamily = (id: FamilyId) => {
    setFamilyId(id);
    setFromId(DEFAULTS[id][0]);
    setToId(DEFAULTS[id][1]);
  };

  const unitSelect = (label: string, value: string, onChange: (id: string) => void) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">{label}</span>
      <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {m.units[u.id]} ({u.short})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FAMILIES) as FamilyId[]).map((id) => (
          <ToolButton key={id} size="sm" variant={id === familyId ? "primary" : "secondary"} onClick={() => pickFamily(id)}>
            {m.families[id]}
          </ToolButton>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label={m.amount}
          type="number"
          inputMode="decimal"
          value={amount}
          placeholder={m.amountPlaceholder}
          onChange={(e) => setAmount(e.target.value)}
        />
        {unitSelect(m.from, from.id, setFromId)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {unitSelect(m.to, to.id, setToId)}
        <div className="flex items-end gap-2">
          <ToolButton
            variant="secondary"
            onClick={() => {
              setFromId(to.id);
              setToId(from.id);
            }}
          >
            {m.swap}
          </ToolButton>
          <ToolButton
            variant="ghost"
            onClick={() => {
              setAmount("1");
              pickFamily(familyId);
            }}
          >
            {m.reset}
          </ToolButton>
        </div>
      </div>

      {valid ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.result}</span>
              <CopyButton text={resultLine} />
            </div>
            <StatCard
              label={m.equals(`${format(parsed)} ${from.short}`)}
              value={resultLine}
              sub={`1 ${from.short} = ${format(convert(1, familyId, from, to))} ${to.short}`}
              accent
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.everyUnit(m.families[familyId])}</span>
            <div className="border border-tool-border bg-tool-surface divide-y divide-tool-border-dim">
              {units.map((unit) => (
                <div key={unit.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <span className="text-sm text-tool-text-dim">
                    {m.units[unit.id]}
                    <span className="ml-2 text-xs text-tool-muted">{unit.short}</span>
                  </span>
                  <span className="font-mono text-sm text-tool-text">{format(convert(parsed, familyId, from, unit))}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-tool-muted">{m.enterNumber}</p>
      )}
    </div>
  );
}
