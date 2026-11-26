import { useState, useCallback } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { useMessages } from "../../i18n/react";

const CHARSET = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

type CharsetKey = keyof typeof CHARSET;

const OPTION_LABELS: Record<CharsetKey, string> = {
  upper: "A–Z",
  lower: "a–z",
  numbers: "0–9",
  symbols: "!@#…",
};

const MIN_LENGTH = 6;
const MAX_LENGTH = 64;

const messages = {
  en: {
    length: "Length",
    include: "Include",
    generate: "Generate Password",
    regenerate: "↺ Regenerate",
    entropy: (bits: number) => `${bits} bits entropy`,
    strength: ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"],
  },
  ko: {
    length: "길이",
    include: "포함할 문자",
    generate: "비밀번호 생성",
    regenerate: "↺ 다시 생성",
    entropy: (bits: number) => `엔트로피 ${bits}비트`,
    strength: ["매우 약함", "약함", "보통", "강함", "매우 강함"],
  },
};

const STRENGTH_STYLES = [
  { color: "bg-red-500", width: "w-1/5" },
  { color: "bg-orange-500", width: "w-2/5" },
  { color: "bg-yellow-500", width: "w-3/5" },
  { color: "bg-blue-500", width: "w-4/5" },
  { color: "bg-green-600", width: "w-full" },
];

function strengthLevel(bits: number): number {
  if (bits < 40) return 0;
  if (bits < 60) return 1;
  if (bits < 80) return 2;
  if (bits < 100) return 3;
  return 4;
}

/** Uniform random index in [0, n) without modulo bias. */
function randomIndex(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

export default function PasswordGenerator() {
  const m = useMessages(messages);
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState<Record<CharsetKey, boolean>>({
    upper: true,
    lower: true,
    numbers: true,
    symbols: false,
  });
  const [password, setPassword] = useState("");

  const keys = Object.keys(CHARSET) as CharsetKey[];
  const charset = keys.filter((k) => opts[k]).map((k) => CHARSET[k]).join("");

  const generate = useCallback(() => {
    if (!charset) return;
    setPassword(Array.from({ length }, () => charset[randomIndex(charset.length)]).join(""));
  }, [length, charset]);

  const bits = Math.round(length * Math.log2(charset.length || 1));
  const level = strengthLevel(bits);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="rounded-xl border border-tool-border bg-tool-surface p-5 flex flex-col gap-5">
        <div>
          <div className="flex justify-between mb-2">
            <label htmlFor="pw-length" className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              {m.length}
            </label>
            <span className="text-sm font-bold text-tool-accent tabular-nums">{length}</span>
          </div>
          <input
            id="pw-length"
            type="range"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-tool-accent cursor-pointer"
          />
          <div className="flex justify-between text-2xs text-tool-muted mt-1">
            <span>{MIN_LENGTH}</span>
            <span>{MAX_LENGTH}</span>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-tool-muted uppercase tracking-wider mb-2">{m.include}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {keys.map((key) => (
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
                  className="accent-tool-accent shrink-0"
                />
                <span className="text-sm font-mono">{OPTION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <ToolButton size="lg" className="w-full" onClick={generate} disabled={!charset}>
        {m.generate}
      </ToolButton>

      {password && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border-2 border-tool-accent/25 bg-tool-accent/5 p-5">
            <div className="font-mono text-lg md:text-xl text-tool-text break-all leading-relaxed tracking-wider">
              {password}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 bg-tool-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${STRENGTH_STYLES[level].color} ${STRENGTH_STYLES[level].width}`}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tool-muted font-medium">{m.strength[level]}</span>
              <span className="text-tool-muted">{m.entropy(bits)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <CopyButton text={password} />
            <ToolButton variant="ghost" size="sm" onClick={generate}>
              {m.regenerate}
            </ToolButton>
          </div>
        </div>
      )}
    </div>
  );
}
