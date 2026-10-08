import { useRef, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";

type Format = "image/webp" | "image/jpeg" | "image/png";

const FORMATS: { value: Format; label: string; ext: string }[] = [
  { value: "image/webp", label: "WebP", ext: "webp" },
  { value: "image/jpeg", label: "JPG", ext: "jpg" },
  { value: "image/png", label: "PNG", ext: "png" },
];

interface Source {
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
}

interface Result {
  size: number;
  width: number;
  height: number;
  url: string;
  name: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function baseName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export default function ImageCompressor() {
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [maxWidth, setMaxWidth] = useState("1600");
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<Format>("image/webp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (source) URL.revokeObjectURL(source.url);
    if (result) URL.revokeObjectURL(result.url);
    setSource(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    if (source) URL.revokeObjectURL(source.url);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSource({
        name: file.name,
        size: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        url,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("This image could not be read.");
    };
    img.src = url;
  };

  const compress = () => {
    if (!source) return;
    setBusy(true);
    setError("");
    const limit = Number(maxWidth);
    const targetWidth =
      Number.isFinite(limit) && limit > 0
        ? Math.min(source.width, Math.round(limit))
        : source.width;
    const scale = targetWidth / source.width;
    const width = Math.max(1, targetWidth);
    const height = Math.max(1, Math.round(source.height * scale));

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Your browser could not prepare the image.");
        setBusy(false);
        return;
      }
      if (format === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("The image could not be encoded in that format.");
            setBusy(false);
            return;
          }
          const ext =
            FORMATS.find((f) => f.value === format)?.ext ?? "img";
          if (result) URL.revokeObjectURL(result.url);
          setResult({
            size: blob.size,
            width,
            height,
            url: URL.createObjectURL(blob),
            name: `${baseName(source.name)}-compressed.${ext}`,
          });
          setBusy(false);
        },
        format,
        format === "image/png" ? undefined : quality / 100,
      );
    };
    img.onerror = () => {
      setError("This image could not be read.");
      setBusy(false);
    };
    img.src = source.url;
  };

  const saved =
    source && result ? Math.round((1 - result.size / source.size) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) loadFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-tool-accent bg-tool-accent/5"
            : "border-tool-border bg-tool-surface hover:border-tool-accent"
        }`}
      >
        <span className="text-sm font-medium text-tool-text">
          Drop an image here, or click to choose a file
        </span>
        <span className="text-xs text-tool-muted">
          JPG, PNG, and WebP are supported. Files stay on your device.
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
          }}
        />
      </div>

      {error && (
        <p className="border border-tool-border bg-tool-surface p-3 text-sm text-tool-text">
          {error}
        </p>
      )}

      {source && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolInput
              label="Max width"
              type="number"
              min={1}
              step={10}
              suffix="px"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              hint="Wider images are scaled down to this width."
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-tool-text-dim">
                Output format
              </span>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <ToolButton
                    key={f.value}
                    size="sm"
                    variant={format === f.value ? "primary" : "secondary"}
                    onClick={() => setFormat(f.value)}
                  >
                    {f.label}
                  </ToolButton>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-tool-text-dim">
                Quality
              </span>
              <span className="font-mono text-sm text-tool-text">
                {quality}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              disabled={format === "image/png"}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-tool-accent disabled:opacity-40"
            />
            <span className="text-xs text-tool-muted">
              {format === "image/png"
                ? "PNG keeps every pixel, so quality has no effect. Lower the width instead."
                : "Lower values make a smaller file with softer detail."}
            </span>
          </div>

          <div className="flex gap-2">
            <ToolButton onClick={compress} disabled={busy}>
              {busy ? "Compressing…" : "Compress"}
            </ToolButton>
            <ToolButton variant="ghost" onClick={reset}>
              Clear
            </ToolButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Original"
              value={formatBytes(source.size)}
              sub={`${source.width} x ${source.height}`}
            />
            <StatCard
              label="Compressed"
              value={result ? formatBytes(result.size) : "—"}
              sub={result ? `${result.width} x ${result.height}` : "Not yet run"}
            />
            <StatCard
              label="Saved"
              value={result ? `${saved}%` : "—"}
              sub={
                result
                  ? saved > 0
                    ? `${formatBytes(source.size - result.size)} smaller`
                    : "This format made it larger"
                  : "Run the compressor"
              }
              accent
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">
                Original
              </span>
              <img
                src={source.url}
                alt="Original image"
                className="w-full border border-tool-border bg-tool-surface object-contain"
              />
            </div>
            {result && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-tool-muted">
                  Compressed
                </span>
                <img
                  src={result.url}
                  alt="Compressed image"
                  className="w-full border border-tool-border bg-tool-surface object-contain"
                />
              </div>
            )}
          </div>

          {result && (
            <a
              href={result.url}
              download={result.name}
              className="inline-flex h-10 items-center justify-center gap-2 self-start bg-tool-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-tool-accent-dim"
            >
              Download {result.name}
            </a>
          )}
        </>
      )}
    </div>
  );
}
