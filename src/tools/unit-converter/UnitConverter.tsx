import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Unit = { id: string; label: string; short: string; factor: number };
type Family = { id: string; label: string; units: Unit[] };

/* factor = how many base units one of this unit is worth */
const FAMILIES: Family[] = [
  {
    id: "length",
    label: "Length",
    units: [
      { id: "mm", label: "Millimeter", short: "mm", factor: 0.001 },
      { id: "cm", label: "Centimeter", short: "cm", factor: 0.01 },
      { id: "m", label: "Meter", short: "m", factor: 1 },
      { id: "km", label: "Kilometer", short: "km", factor: 1000 },
      { id: "in", label: "Inch", short: "in", factor: 0.0254 },
      { id: "ft", label: "Foot", short: "ft", factor: 0.3048 },
      { id: "yd", label: "Yard", short: "yd", factor: 0.9144 },
      { id: "mi", label: "Mile", short: "mi", factor: 1609.344 },
      { id: "nmi", label: "Nautical mile", short: "nmi", factor: 1852 },
    ],
  },
  {
    id: "weight",
    label: "Weight",
    units: [
      { id: "mg", label: "Milligram", short: "mg", factor: 0.001 },
      { id: "g", label: "Gram", short: "g", factor: 1 },
      { id: "kg", label: "Kilogram", short: "kg", factor: 1000 },
      { id: "t", label: "Metric ton", short: "t", factor: 1_000_000 },
      { id: "oz", label: "Ounce", short: "oz", factor: 28.349523125 },
      { id: "lb", label: "Pound", short: "lb", factor: 453.59237 },
      { id: "st", label: "Stone", short: "st", factor: 6350.29318 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    units: [
      { id: "ml", label: "Milliliter", short: "ml", factor: 0.001 },
      { id: "l", label: "Liter", short: "L", factor: 1 },
      { id: "tsp", label: "Teaspoon (US)", short: "tsp", factor: 0.00492892159375 },
      { id: "tbsp", label: "Tablespoon (US)", short: "tbsp", factor: 0.01478676478125 },
      { id: "floz", label: "Fluid ounce (US)", short: "fl oz", factor: 0.0295735295625 },
      { id: "cup", label: "Cup (US)", short: "cup", factor: 0.2365882365 },
      { id: "pt", label: "Pint (US)", short: "pt", factor: 0.473176473 },
      { id: "qt", label: "Quart (US)", short: "qt", factor: 0.946352946 },
      { id: "gal", label: "Gallon (US)", short: "gal", factor: 3.785411784 },
      { id: "impfloz", label: "Fluid ounce (UK)", short: "fl oz UK", factor: 0.0284130625 },
      { id: "imppt", label: "Pint (UK)", short: "pt UK", factor: 0.56826125 },
      { id: "impgal", label: "Gallon (UK)", short: "gal UK", factor: 4.54609 },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    units: [
      { id: "c", label: "Celsius", short: "°C", factor: 1 },
      { id: "f", label: "Fahrenheit", short: "°F", factor: 1 },
      { id: "k", label: "Kelvin", short: "K", factor: 1 },
    ],
  },
];

const DEFAULTS: Record<string, [string, string]> = {
  length: ["cm", "in"],
  weight: ["kg", "lb"],
  volume: ["l", "gal"],
  temperature: ["c", "f"],
};

/* temperature needs offsets, so it is converted through Celsius instead of a factor */
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

function convert(value: number, family: Family, from: Unit, to: Unit): number {
  if (family.id === "temperature") {
    return fromCelsius(toCelsius(value, from.id), to.id);
  }
  return (value * from.factor) / to.factor;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return value.toExponential(6);
  const rounded = Number(value.toFixed(6));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default function UnitConverter() {
  const [familyId, setFamilyId] = useState("length");
  const [amount, setAmount] = useState("1");
  const [fromId, setFromId] = useState(DEFAULTS.length[0]);
  const [toId, setToId] = useState(DEFAULTS.length[1]);

  const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
  const from = family.units.find((u) => u.id === fromId) ?? family.units[0];
  const to = family.units.find((u) => u.id === toId) ?? family.units[1];

  const parsed = amount.trim() === "" ? NaN : Number(amount);
  const valid = Number.isFinite(parsed);

  const result = useMemo(
    () => (valid ? convert(parsed, family, from, to) : NaN),
    [parsed, valid, family, from, to],
  );

  const all = useMemo(
    () =>
      valid
        ? family.units.map((u) => ({ unit: u, value: convert(parsed, family, from, u) }))
        : [],
    [parsed, valid, family, from],
  );

  const pickFamily = (id: string) => {
    setFamilyId(id);
    const [a, b] = DEFAULTS[id];
    setFromId(a);
    setToId(b);
  };

  const swap = () => {
    setFromId(to.id);
    setToId(from.id);
  };

  const selectClass =
    "h-10 w-full rounded-none border border-tool-border bg-tool-surface px-3 text-sm text-tool-text focus:outline-none focus:border-tool-accent";

  const resultLine = valid ? `${format(result)} ${to.short}` : "";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <ToolButton
            key={f.id}
            size="sm"
            variant={f.id === familyId ? "primary" : "secondary"}
            onClick={() => pickFamily(f.id)}
          >
            {f.label}
          </ToolButton>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToolInput
          label="Amount"
          type="number"
          inputMode="decimal"
          value={amount}
          placeholder="Enter a number"
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
            From
          </label>
          <select
            className={selectClass}
            value={from.id}
            onChange={(e) => setFromId(e.target.value)}
          >
            {family.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.short})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
            To
          </label>
          <select
            className={selectClass}
            value={to.id}
            onChange={(e) => setToId(e.target.value)}
          >
            {family.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.short})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <ToolButton variant="secondary" onClick={swap}>
            Swap units
          </ToolButton>
          <ToolButton
            variant="ghost"
            onClick={() => {
              setAmount("1");
              pickFamily(familyId);
            }}
          >
            Reset
          </ToolButton>
        </div>
      </div>

      {valid ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Result
              </span>
              <CopyButton text={resultLine} />
            </div>
            <StatCard
              label={`${format(parsed)} ${from.short} equals`}
              value={resultLine}
              sub={`1 ${from.short} = ${format(convert(1, family, from, to))} ${to.short}`}
              accent
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Every {family.label.toLowerCase()} unit
            </span>
            <div className="border border-tool-border bg-tool-surface">
              {all.map(({ unit, value }, i) => (
                <div
                  key={unit.id}
                  className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${
                    i === 0 ? "" : "border-t border-tool-border-dim"
                  }`}
                >
                  <span className="text-sm text-tool-text-dim">
                    {unit.label}
                    <span className="ml-2 text-xs text-tool-muted">{unit.short}</span>
                  </span>
                  <span className="font-mono text-sm text-tool-text">{format(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-tool-muted">
          Enter a number above to see the converted value.
        </p>
      )}
    </div>
  );
}
