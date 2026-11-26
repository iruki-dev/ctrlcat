import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useLang, useMessages } from "../../i18n/react";

type Claims = Record<string, unknown>;
type Section = "header" | "payload";
type TimeClaim = "iat" | "nbf" | "exp";

type DecodeError =
  | { code: "parts"; count: number }
  | { code: "emptyPart" }
  | { code: "notBase64" | "notJson" | "notObject"; section: Section };

const messages = {
  en: {
    label: "JSON Web Token",
    hint: "Everything is decoded in your browser. The token is never sent anywhere, and the signature is not verified.",
    decode: "Decode",
    clear: "Clear",
    sections: { header: "header", payload: "payload" } as Record<Section, string>,
    errors: {
      parts: (n: number) => `A token needs three parts separated by dots. This one has ${n}.`,
      emptyPart: "The header or payload part of this token is empty.",
      notBase64: (s: string) => `The ${s} is not valid base64url text.`,
      notJson: (s: string) => `The ${s} decoded, but it is not valid JSON.`,
      notObject: (s: string) => `The ${s} is not a JSON object.`,
    },
    algorithm: "Algorithm",
    algSub: "From the alg header",
    type: "Type",
    typSub: "From the typ header",
    notSet: "not set",
    expiry: "Expiry",
    noExpiry: "No expiry",
    noExpirySub: "This token has no exp claim",
    valid: "Valid",
    expired: "Expired",
    left: (d: string) => `${d} left`,
    ago: (d: string) => `${d} ago`,
    units: { d: "d", h: "h", m: "m", s: "s" },
    timeClaims: "Time claims",
    claims: { iat: "Issued at", nbf: "Not valid before", exp: "Expires at" } as Record<TimeClaim, string>,
    header: "Header",
    payload: "Payload",
    signature: "Signature",
    noSignature: "This token has no signature part.",
    signatureNote: "The signature is shown as it appears in the token. Checking it needs the signing key, so keep that step on your server.",
  },
  ko: {
    label: "JSON 웹 토큰",
    hint: "모든 디코딩은 브라우저에서 이루어집니다. 토큰은 어디로도 전송되지 않으며 서명은 검증하지 않습니다.",
    decode: "디코딩",
    clear: "지우기",
    sections: { header: "헤더", payload: "페이로드" } as Record<Section, string>,
    errors: {
      parts: (n: number) => `토큰은 점으로 구분된 세 부분이어야 합니다. 이 토큰은 ${n}부분입니다.`,
      emptyPart: "이 토큰의 헤더나 페이로드가 비어 있습니다.",
      notBase64: (s: string) => `${s}가 올바른 base64url 텍스트가 아닙니다.`,
      notJson: (s: string) => `${s}는 디코딩되었지만 올바른 JSON이 아닙니다.`,
      notObject: (s: string) => `${s}가 JSON 객체가 아닙니다.`,
    },
    algorithm: "알고리즘",
    algSub: "alg 헤더 값",
    type: "유형",
    typSub: "typ 헤더 값",
    notSet: "없음",
    expiry: "만료",
    noExpiry: "만료 없음",
    noExpirySub: "이 토큰에는 exp 클레임이 없습니다",
    valid: "유효",
    expired: "만료됨",
    left: (d: string) => `${d} 남음`,
    ago: (d: string) => `${d} 전`,
    units: { d: "일 ", h: "시간 ", m: "분 ", s: "초" },
    timeClaims: "시간 클레임",
    claims: { iat: "발급 시각", nbf: "유효 시작", exp: "만료 시각" } as Record<TimeClaim, string>,
    header: "헤더",
    payload: "페이로드",
    signature: "서명",
    noSignature: "이 토큰에는 서명 부분이 없습니다.",
    signatureNote: "서명은 토큰에 적힌 그대로 보여줍니다. 서명 검증에는 서명 키가 필요하므로 서버에서 하세요.",
  },
};

const TIME_CLAIMS: TimeClaim[] = ["iat", "nbf", "exp"];

function base64UrlDecode(part: string): string {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeSection(part: string, section: Section): { value: Claims; text: string } | DecodeError {
  let text: string;
  try {
    text = base64UrlDecode(part);
  } catch {
    return { code: "notBase64", section };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { code: "notJson", section };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { code: "notObject", section };
  return { value: value as Claims, text: JSON.stringify(value, null, 2) };
}

function decodeToken(raw: string) {
  const parts = raw.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) return { error: { code: "parts", count: parts.length } as DecodeError };
  const [rawHeader, rawPayload, signature] = parts;
  if (rawHeader === "" || rawPayload === "") return { error: { code: "emptyPart" } as DecodeError };

  const header = decodeSection(rawHeader, "header");
  if ("code" in header) return { error: header };
  const payload = decodeSection(rawPayload, "payload");
  if ("code" in payload) return { error: payload };
  return { decoded: { header, payload, signature } };
}

const asSeconds = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export default function JwtDecoder() {
  const m = useMessages(messages);
  const lang = useLang();
  const [input, setInput] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const result = useMemo(() => (input.trim() === "" ? null : decodeToken(input)), [input]);
  const decoded = result?.decoded;

  const errorText = (e: DecodeError) => {
    if (e.code === "parts") return m.errors.parts(e.count);
    if (e.code === "emptyPart") return m.errors.emptyPart;
    return m.errors[e.code](m.sections[e.section]);
  };

  const formatDuration = (totalSeconds: number) => {
    const s = Math.abs(Math.round(totalSeconds));
    const [d, h, min] = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60)];
    const u = m.units;
    if (d > 0) return `${d}${u.d}${h}${u.h}`.trim();
    if (h > 0) return `${h}${u.h}${min}${u.m}`.trim();
    if (min > 0) return `${min}${u.m}${s % 60}${u.s}`.trim();
    return `${s}${u.s}`;
  };

  const header = decoded?.header.value;
  const payload = decoded?.payload.value;
  const algorithm = typeof header?.alg === "string" ? header.alg : "none";
  const tokenType = typeof header?.typ === "string" ? header.typ : m.notSet;
  const exp = asSeconds(payload?.exp);
  const nowSeconds = now / 1000;
  const live = exp !== null && exp > nowSeconds;
  const timeRows = payload
    ? TIME_CLAIMS.flatMap((key) => {
        const seconds = asSeconds(payload[key]);
        return seconds === null ? [] : [{ key, seconds }];
      })
    : [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label={m.label}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.signature"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        hint={m.hint}
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
          {m.decode}
        </ToolButton>
        <ToolButton variant="ghost" onClick={() => setInput("")}>
          {m.clear}
        </ToolButton>
      </div>

      {result?.error && <ToolNotice>{errorText(result.error)}</ToolNotice>}

      {decoded && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={m.algorithm} value={algorithm} sub={m.algSub} />
            <StatCard label={m.type} value={tokenType} sub={m.typSub} />
            <StatCard
              label={m.expiry}
              value={exp === null ? m.noExpiry : live ? m.valid : m.expired}
              sub={
                exp === null
                  ? m.noExpirySub
                  : live
                    ? m.left(formatDuration(exp - nowSeconds))
                    : m.ago(formatDuration(nowSeconds - exp))
              }
              accent={live}
            />
          </div>

          {timeRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.timeClaims}</span>
              <div className="border border-tool-border bg-tool-surface divide-y divide-tool-border">
                {timeRows.map(({ key, seconds }) => (
                  <div key={key} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                    <span className="text-sm text-tool-text-dim">
                      {m.claims[key]} <span className="font-mono text-tool-muted">({key})</span>
                    </span>
                    <span className="font-mono text-sm text-tool-text">{new Date(seconds * 1000).toLocaleString(lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(["header", "payload"] as const).map((section) => (
            <div key={section} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m[section]}</span>
                <CopyButton text={decoded[section].text} />
              </div>
              <div className="border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-text whitespace-pre-wrap break-all">
                {decoded[section].text}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.signature}</span>
            <div className="border border-tool-border bg-tool-surface p-4 font-mono text-sm text-tool-muted whitespace-pre-wrap break-all">
              {decoded.signature === "" ? m.noSignature : decoded.signature}
            </div>
            <p className="text-xs text-tool-muted leading-relaxed">{m.signatureNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
