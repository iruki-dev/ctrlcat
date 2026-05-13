import { useState, useCallback } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";

const CHARSET = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

type CharsetKey = keyof typeof CHARSET;

interface Options {
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
}

function entropy(length: number, charsetSize: number): number {
  return Math.round(length * Math.log2(charsetSize));
}

function strengthLabel(bits: number): { label: string; color: string; width: string } {
  if (bits < 40) return { label: "Very Weak", color: "bg-red-500", width: "w-1/5" };
  if (bits < 60) return { label: "Weak", color: "bg-orange-500", width: "w-2/5" };
  if (bits < 80) return { label: "Fair", color: "bg-yellow-500", width: "w-3/5" };
  if (bits < 100) return { label: "Strong", color: "bg-blue-500", width: "w-4/5" };
  return { label: "Very Strong", color: "bg-green-600", width: "w-full" };
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState<Options>({
    upper: true,
    lower: true,
    numbers: true,
    symbols: false,
  });
  const [password, setPassword] = useState("");

  const charset = (Object.keys(CHARSET) as CharsetKey[])
    .filter((k) => opts[k])
    .map((k) => CHARSET[k])
    .join("");

  const generate = useCallback(() => {
    if (!charset) return;
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    setPassword(Array.from(arr, (v) => charset[v % charset.length]).join(""));
  }, [length, charset]);

  const bits = entropy(length, charset.length || 1);
  const strength = strengthLabel(bits);

  const optionLabels: Record<CharsetKey, string> = {
    upper: "A–Z",
    lower: "a–z",
    numbers: "0–9",
    symbols: "!@#…",
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Settings */}
      <div className="rounded-xl border border-tool-border bg-tool-surface p-5 flex flex-col gap-5">
        {/* Length slider */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Length
            </span>
            <span className="text-sm font-bold text-tool-accent tabular-nums">{length}</span>
          </div>
          <input
            type="range"
            min={6}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-[#0891b2] cursor-pointer"
          />
          <div className="flex justify-between text-2xs text-tool-muted mt-1">
            <span>6</span>
            <span>64</span>
          </div>
        </div>

        {/* Character types */}
        <div>
          <div className="text-xs font-medium text-tool-muted uppercase tracking-wider mb-2">
            Include
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(CHARSET) as CharsetKey[]).map((key) => (
              <label
                key={key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  opts[key]
                    ? "border-tool-accent/50 bg-tool-accent/5 text-tool-text"
                    : "border-tool-border bg-tool-bg text-tool-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={opts[key]}
                  onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))}
                  className="accent-[#0891b2] shrink-0"
                />
                <span className="text-sm font-mono">{optionLabels[key]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <ToolButton
        size="lg"
        className="w-full"
        onClick={generate}
        disabled={!charset}
      >
        Generate Password
      </ToolButton>

      {password && (
        <div className="flex flex-col gap-3">
          {/* Password display */}
          <div className="rounded-xl border-2 border-tool-accent/25 bg-tool-accent/5 p-5">
            <div className="font-mono text-lg md:text-xl text-tool-text break-all leading-relaxed tracking-wider">
              {password}
            </div>
          </div>

          {/* Strength bar */}
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 bg-tool-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tool-muted font-medium">{strength.label}</span>
              <span className="text-tool-muted">{bits} bits entropy</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <CopyButton text={password} />
            <ToolButton variant="ghost" size="sm" onClick={generate}>
              ↺ Regenerate
            </ToolButton>
          </div>
        </div>
      )}
    </div>
  );
}
