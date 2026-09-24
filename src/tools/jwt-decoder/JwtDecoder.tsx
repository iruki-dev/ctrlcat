import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type Claims = Record<string, unknown>;

interface Decoded {
  header: Claims;
  payload: Claims;
  headerText: string;
  payloadText: string;
  signature: string;
}

function base64UrlDecode(part: string): string {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeToken(raw: string): Decoded {
  const token = raw.trim().replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(
      `A token needs three parts separated by dots. This one has ${parts.length}.`,
    );
  }
  const [rawHeader, rawPayload, signature] = parts;
  if (rawHeader === "" || rawPayload === "") {
    throw new Error("The header or payload part of this token is empty.");
  }

  const sections: Array<["header" | "payload", string]> = [
    ["header", rawHeader],
    ["payload", rawPayload],
  ];
  const parsed: Record<string, { value: Claims; text: string }> = {};

  for (const [name, part] of sections) {
    let text: string;
    try {
      text = base64UrlDecode(part);
    } catch {
      throw new Error(`The ${name} is not valid base64url text.`);
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`The ${name} decoded, but it is not valid JSON.`);
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`The ${name} is not a JSON object.`);
    }
    parsed[name] = {
      value: value as Claims,
      text: JSON.stringify(value, null, 2),
    };
  }

  return {
    header: parsed.header.value,
    payload: parsed.payload.value,
    headerText: parsed.header.text,
    payloadText: parsed.payload.text,
    signature,
  };
}

function asSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

function formatDuration(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${s % 60}s`;
  return `${s}s`;
}

const TIME_CLAIMS: Array<[string, string]> = [
  ["iat", "Issued at"],
  ["nbf", "Not valid before"],
  ["exp", "Expires at"],
];

export default function JwtDecoder() {
  const [input, setInput] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const result = useMemo(() => {
    if (input.trim() === "") return null;
    try {
      return { decoded: decodeToken(input), error: null as string | null };
    } catch (err) {
      return {
        decoded: null,
        error: err instanceof Error ? err.message : "This token could not be read.",
      };
    }
  }, [input]);

  const decoded = result?.decoded ?? null;

  const algorithm =
    decoded && typeof decoded.header.alg === "string" ? decoded.header.alg : "none";
  const tokenType =
    decoded && typeof decoded.header.typ === "string" ? decoded.header.typ : "not set";

  const exp = decoded ? asSeconds(decoded.payload.exp) : null;
  const nowSeconds = now / 1000;
  const expiryValue =
    exp === null ? "No expiry" : exp > nowSeconds ? "Valid" : "Expired";
  const expirySub =
    exp === null
      ? "This token has no exp claim"
      : exp > nowSeconds
        ? `${formatDuration(exp - nowSeconds)} left`
        : `${formatDuration(nowSeconds - exp)} ago`;

  const timeRows = decoded
    ? TIME_CLAIMS.map(([key, label]) => [key, label, asSeconds(decoded.payload[key])] as const).filter(
        (row) => row[2] !== null,
      )
    : [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label="JSON Web Token"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.signature"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        hint="Everything is decoded in your browser. The token is never sent anywhere, and the signature is not verified."
        spellCheck={false}
      />

      <div className="flex gap-2">
        <ToolButton
          onClick={() => {
            setNow(Date.now());
            setInput(input.trim());
          }}
          disabled={input.trim() === ""}
        >
          Decode
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setInput("")}>
          Clear
        </ToolButton>
      </div>

      {result?.error && (
        <div className="border border-tool-border bg-tool-surface p-4 text-sm text-tool-text">
          {result.error}
        </div>
      )}

      {decoded && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Algorithm" value={algorithm} sub="From the alg header" />
            <StatCard label="Type" value={tokenType} sub="From the typ header" />
            <StatCard
              label="Expiry"
              value={expiryValue}
              sub={expirySub}
              accent={exp !== null && exp > nowSeconds}
            />
          </div>

          {timeRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Time claims
              </span>
              <div className="border border-tool-border bg-tool-surface divide-y divide-tool-border">
                {timeRows.map(([key, label, seconds]) => (
                  <div
                    key={key}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="text-sm text-tool-text-dim">
                      {label} <span className="font-mono text-tool-muted">({key})</span>
                    </span>
                    <span className="font-mono text-sm text-tool-text">
                      {formatTime(seconds as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Header
              </span>
              <CopyButton text={decoded.headerText} />
            </div>
            <div className="border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {decoded.headerText}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                Payload
              </span>
              <CopyButton text={decoded.payloadText} />
            </div>
            <div className="border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
              {decoded.payloadText}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
              Signature
            </span>
            <div className="border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-muted whitespace-pre-wrap break-all">
              {decoded.signature === ""
                ? "This token has no signature part."
                : decoded.signature}
            </div>
            <p className="text-xs text-tool-muted leading-relaxed">
              The signature is shown as it appears in the token. Checking it needs the
              signing key, so keep that step on your server.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
