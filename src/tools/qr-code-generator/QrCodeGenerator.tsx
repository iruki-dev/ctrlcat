import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";
import { encodeQr, type EccLevel } from "./qr";

const ECC_LEVELS: EccLevel[] = ["L", "M", "Q", "H"];
const ECC_RECOVERY: Record<EccLevel, number> = { L: 7, M: 15, Q: 25, H: 30 };
const QUIET_ZONE = 4;

const messages = {
  en: {
    label: "Text or URL",
    hint: "Everything is encoded in your browser. Nothing is uploaded.",
    ecc: "Error correction",
    eccHint: (level: string, pct: number) => `Level ${level} can still be read with about ${pct}% of the code damaged.`,
    tooLong: (level: string) =>
      `This text is too long for a single QR code at level ${level}. Shorten it, or pick a lower error correction level.`,
    version: "Version",
    grid: "Grid",
    modules: "modules",
    bytesUsed: "Bytes used",
    mask: "Mask",
    qrCode: "QR code",
    alt: "Generated QR code",
    pngSize: "PNG size",
    downloadPng: "Download PNG",
    downloadSvg: "Download SVG",
    clear: "Clear",
  },
  ko: {
    label: "텍스트 또는 URL",
    hint: "모든 인코딩은 브라우저에서 이루어집니다. 아무것도 업로드되지 않습니다.",
    ecc: "오류 정정 수준",
    eccHint: (level: string, pct: number) => `${level} 수준은 코드가 약 ${pct}% 손상되어도 읽을 수 있습니다.`,
    tooLong: (level: string) =>
      `${level} 수준에서는 텍스트가 너무 길어 QR 코드 하나에 담을 수 없습니다. 텍스트를 줄이거나 더 낮은 수준을 선택하세요.`,
    version: "버전",
    grid: "격자",
    modules: "모듈",
    bytesUsed: "사용한 바이트",
    mask: "마스크",
    qrCode: "QR 코드",
    alt: "생성된 QR 코드",
    pngSize: "PNG 크기",
    downloadPng: "PNG 다운로드",
    downloadSvg: "SVG 다운로드",
    clear: "지우기",
  },
};

function buildPath(modules: boolean[][]): string {
  const parts: string[] = [];
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
    }),
  );
  return parts.join("");
}

function buildSvg(path: string, total: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/><path fill="#000000" d="${path}"/></svg>`
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function QrCodeGenerator() {
  const m = useMessages(messages);
  const [text, setText] = useState("");
  const [ecc, setEcc] = useState<EccLevel>("M");
  const [pngSize, setPngSize] = useState("512");

  const qr = useMemo(() => (text === "" ? null : encodeQr(text, ecc)), [text, ecc]);
  const total = qr ? qr.size + QUIET_ZONE * 2 : 0;
  const path = useMemo(() => (qr ? buildPath(qr.modules) : ""), [qr]);
  const svgMarkup = qr ? buildSvg(path, total) : "";

  const downloadPng = () => {
    if (!qr) return;
    const requested = Number.parseInt(pngSize, 10);
    const target = Number.isFinite(requested) ? Math.min(Math.max(requested, 64), 4096) : 512;
    const scale = Math.max(1, Math.round(target / total));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = total * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    qr.modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) ctx.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale);
      }),
    );
    canvas.toBlob((blob) => blob && downloadBlob(blob, "qr-code.png"), "image/png");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label={m.label}
        placeholder="https://ctrlcat.dev"
        hint={m.hint}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.ecc}</span>
        <div className="flex flex-wrap gap-2">
          {ECC_LEVELS.map((level) => (
            <ToolButton key={level} size="sm" variant={ecc === level ? "primary" : "ghost"} onClick={() => setEcc(level)}>
              {level}
            </ToolButton>
          ))}
        </div>
        <span className="text-xs text-tool-text-dim">{m.eccHint(ecc, ECC_RECOVERY[ecc])}</span>
      </div>

      {text !== "" && qr === null && <ToolNotice>{m.tooLong(ecc)}</ToolNotice>}

      {qr && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={m.version} value={qr.version} accent />
            <StatCard label={m.grid} value={`${qr.size} x ${qr.size}`} sub={m.modules} />
            <StatCard label={m.bytesUsed} value={`${qr.byteLength} / ${qr.capacity}`} />
            <StatCard label={m.mask} value={qr.mask} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">{m.qrCode}</span>
              <CopyButton text={svgMarkup} />
            </div>
            <div className="flex justify-center rounded-lg border border-tool-border bg-tool-surface p-6">
              <svg
                viewBox={`0 0 ${total} ${total}`}
                className="h-auto w-full max-w-xs"
                shapeRendering="crispEdges"
                role="img"
                aria-label={m.alt}
              >
                <rect width={total} height={total} fill="#ffffff" />
                <path fill="#000000" d={path} />
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <ToolInput
                label={m.pngSize}
                suffix="px"
                type="number"
                min={64}
                max={4096}
                value={pngSize}
                onChange={(e) => setPngSize(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={downloadPng}>{m.downloadPng}</ToolButton>
              <ToolButton
                variant="secondary"
                onClick={() => downloadBlob(new Blob([svgMarkup], { type: "image/svg+xml" }), "qr-code.svg")}
              >
                {m.downloadSvg}
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => setText("")}>
                {m.clear}
              </ToolButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
