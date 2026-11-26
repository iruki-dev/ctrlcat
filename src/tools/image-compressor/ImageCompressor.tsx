import { useEffect, useRef, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { ToolNotice } from "../../components/tools/ui/Notice";
import { useMessages } from "../../i18n/react";
import { formatBytes } from "../lib/format";

type Format = "image/webp" | "image/jpeg" | "image/png";

const FORMATS: { value: Format; label: string; ext: string }[] = [
  { value: "image/webp", label: "WebP", ext: "webp" },
  { value: "image/jpeg", label: "JPG", ext: "jpg" },
  { value: "image/png", label: "PNG", ext: "png" },
];

type ErrorCode = "notImage" | "unreadable" | "noCanvas" | "encodeFailed";

const messages = {
  en: {
    drop: "Drop an image here, or click to choose a file",
    dropHint: "JPG, PNG, and WebP are supported. Files stay on your device.",
    errors: {
      notImage: "That file is not an image.",
      unreadable: "This image could not be read.",
      noCanvas: "Your browser could not prepare the image.",
      encodeFailed: "The image could not be encoded in that format.",
    } as Record<ErrorCode, string>,
    maxWidth: "Max width",
    maxWidthHint: "Wider images are scaled down to this width.",
    outputFormat: "Output format",
    quality: "Quality",
    pngHint: "PNG keeps every pixel, so quality has no effect. Lower the width instead.",
    qualityHint: "Lower values make a smaller file with softer detail.",
    compress: "Compress",
    compressing: "Compressing…",
    clear: "Clear",
    original: "Original",
    compressed: "Compressed",
    notYetRun: "Not yet run",
    saved: "Saved",
    smaller: (size: string) => `${size} smaller`,
    larger: "This format made it larger",
    runIt: "Run the compressor",
    originalAlt: "Original image",
    compressedAlt: "Compressed image",
    download: (name: string) => `Download ${name}`,
  },
  ko: {
    drop: "이미지를 여기에 끌어다 놓거나 클릭해서 파일을 선택하세요",
    dropHint: "JPG, PNG, WebP를 지원합니다. 파일은 기기 밖으로 나가지 않습니다.",
    errors: {
      notImage: "이미지 파일이 아닙니다.",
      unreadable: "이미지를 읽을 수 없습니다.",
      noCanvas: "브라우저에서 이미지를 준비하지 못했습니다.",
      encodeFailed: "이 형식으로 이미지를 저장할 수 없습니다.",
    } as Record<ErrorCode, string>,
    maxWidth: "최대 너비",
    maxWidthHint: "이보다 넓은 이미지는 이 너비로 줄어듭니다.",
    outputFormat: "출력 형식",
    quality: "품질",
    pngHint: "PNG는 모든 픽셀을 그대로 보존하므로 품질 설정이 적용되지 않습니다. 대신 너비를 줄이세요.",
    qualityHint: "값이 낮을수록 파일은 작아지고 디테일은 흐려집니다.",
    compress: "압축",
    compressing: "압축 중…",
    clear: "지우기",
    original: "원본",
    compressed: "압축본",
    notYetRun: "아직 실행 전",
    saved: "절감",
    smaller: (size: string) => `${size} 줄어듦`,
    larger: "이 형식에서는 오히려 커졌습니다",
    runIt: "압축을 실행하세요",
    originalAlt: "원본 이미지",
    compressedAlt: "압축된 이미지",
    download: (name: string) => `${name} 다운로드`,
  },
};

interface Picture {
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || name;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export default function ImageCompressor() {
  const m = useMessages(messages);
  const [source, setSource] = useState<Picture | null>(null);
  const [result, setResult] = useState<Picture | null>(null);
  const [maxWidth, setMaxWidth] = useState("1600");
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<Format>("image/webp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Object URLs pin their blobs in memory until revoked.
  useEffect(() => {
    if (source) return () => URL.revokeObjectURL(source.url);
  }, [source]);
  useEffect(() => {
    if (result) return () => URL.revokeObjectURL(result.url);
  }, [result]);

  const reset = () => {
    setSource(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadFile = async (file: File) => {
    setResult(null);
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("notImage");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setSource({ name: file.name, size: file.size, width: img.naturalWidth, height: img.naturalHeight, url });
    } catch {
      URL.revokeObjectURL(url);
      setError("unreadable");
    }
  };

  const compress = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      setError(await encode(source));
    } finally {
      setBusy(false);
    }
  };

  const encode = async (src: Picture): Promise<ErrorCode | null> => {
    const limit = Number(maxWidth);
    const width = Math.max(1, limit > 0 ? Math.min(src.width, Math.round(limit)) : src.width);
    const height = Math.max(1, Math.round(src.height * (width / src.width)));

    const img = await loadImage(src.url).catch(() => null);
    if (!img) return "unreadable";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "noCanvas";
    // JPEG has no alpha channel; without a fill, transparent areas turn black.
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format, format === "image/png" ? undefined : quality / 100),
    );
    if (!blob) return "encodeFailed";
    const ext = FORMATS.find((f) => f.value === format)!.ext;
    setResult({ size: blob.size, width, height, url: URL.createObjectURL(blob), name: `${baseName(src.name)}-compressed.${ext}` });
    return null;
  };

  const saved = source && result ? Math.round((1 - result.size / source.size) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void loadFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-8 text-center transition-colors focus-within:ring-2 focus-within:ring-tool-accent ${
          dragging ? "border-tool-accent bg-tool-accent/5" : "border-tool-border bg-tool-surface hover:border-tool-accent"
        }`}
      >
        <span className="text-sm font-medium text-tool-text">{m.drop}</span>
        <span className="text-xs text-tool-muted">{m.dropHint}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
          }}
        />
      </label>

      {error && <ToolNotice>{m.errors[error]}</ToolNotice>}

      {source && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolInput
              label={m.maxWidth}
              type="number"
              min={1}
              step={10}
              suffix="px"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              hint={m.maxWidthHint}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-tool-text-dim">{m.outputFormat}</span>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <ToolButton key={f.value} size="sm" variant={format === f.value ? "primary" : "secondary"} onClick={() => setFormat(f.value)}>
                    {f.label}
                  </ToolButton>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="img-quality" className="text-xs font-semibold uppercase tracking-wider text-tool-text-dim">
                {m.quality}
              </label>
              <span className="font-mono text-sm text-tool-text">{quality}</span>
            </div>
            <input
              id="img-quality"
              type="range"
              min={10}
              max={100}
              value={quality}
              disabled={format === "image/png"}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-tool-accent disabled:opacity-40"
            />
            <span className="text-xs text-tool-muted">{format === "image/png" ? m.pngHint : m.qualityHint}</span>
          </div>

          <div className="flex gap-2">
            <ToolButton onClick={compress} disabled={busy}>
              {busy ? m.compressing : m.compress}
            </ToolButton>
            <ToolButton variant="ghost" onClick={reset}>
              {m.clear}
            </ToolButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={m.original} value={formatBytes(source.size)} sub={`${source.width} x ${source.height}`} />
            <StatCard
              label={m.compressed}
              value={result ? formatBytes(result.size) : "—"}
              sub={result ? `${result.width} x ${result.height}` : m.notYetRun}
            />
            <StatCard
              label={m.saved}
              value={result ? `${saved}%` : "—"}
              sub={result ? (saved > 0 ? m.smaller(formatBytes(source.size - result.size)) : m.larger) : m.runIt}
              accent
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { pic: source, label: m.original, alt: m.originalAlt },
              ...(result ? [{ pic: result, label: m.compressed, alt: m.compressedAlt }] : []),
            ].map(({ pic, label, alt }) => (
              <div key={label} className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">{label}</span>
                <img src={pic.url} alt={alt} className="w-full border border-tool-border bg-tool-surface object-contain" />
              </div>
            ))}
          </div>

          {result && (
            <a
              href={result.url}
              download={result.name}
              className="inline-flex h-10 items-center justify-center gap-2 self-start bg-tool-accent px-4 text-sm font-semibold text-tool-on-accent transition-colors hover:bg-tool-accent-dim"
            >
              {m.download(result.name)}
            </a>
          )}
        </>
      )}
    </div>
  );
}
