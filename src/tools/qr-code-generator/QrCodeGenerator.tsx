import { useMemo, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolTextarea } from "../../components/tools/ui/Textarea";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { CopyButton } from "../../components/tools/ui/CopyButton";

type EccLevel = "L" | "M" | "Q" | "H";

const ECC_LEVELS: EccLevel[] = ["L", "M", "Q", "H"];

const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

const ECC_RECOVERY: Record<EccLevel, string> = {
  L: "about 7%",
  M: "about 15%",
  Q: "about 25%",
  H: "about 30%",
};

const ECC_CODEWORDS_PER_BLOCK: Record<EccLevel, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const ECC_BLOCK_COUNT: Record<EccLevel, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecc: EccLevel): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][version] * ECC_BLOCK_COUNT[ecc][version]
  );
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function appendBits(value: number, length: number, bits: number[]): void {
  for (let i = length - 1; i >= 0; i--) {
    bits.push((value >>> i) & 1);
  }
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function interleave(data: number[], version: number, ecc: EccLevel): number[] {
  const blockCount = ECC_BLOCK_COUNT[ecc][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockCount = blockCount - (rawCodewords % blockCount);
  const shortBlockLen = Math.floor(rawCodewords / blockCount);

  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i++) {
    const length = shortBlockLen - blockEccLen + (i < shortBlockCount ? 0 : 1);
    const chunk = data.slice(offset, offset + length);
    offset += length;
    const parity = rsRemainder(chunk, divisor);
    const padded = chunk.slice();
    if (i < shortBlockCount) padded.push(0);
    blocks.push(padded.concat(parity));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= shortBlockCount) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

function finderPenaltyCount(history: number[]): number {
  const n = history[1];
  const core =
    n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
  return (
    (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
    (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
  );
}

function finderPenaltyAdd(runLength: number, history: number[], size: number): void {
  let length = runLength;
  if (history[0] === 0) length += size;
  history.pop();
  history.unshift(length);
}

function finderPenaltyFinish(
  runColor: boolean,
  runLength: number,
  history: number[],
  size: number,
): number {
  let length = runLength;
  if (runColor) {
    finderPenaltyAdd(length, history, size);
    length = 0;
  }
  length += size;
  finderPenaltyAdd(length, history, size);
  return finderPenaltyCount(history);
}

function penaltyScore(modules: boolean[][], size: number): number {
  let result = 0;

  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runLength = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (modules[y][x] === runColor) {
        runLength++;
        if (runLength === 5) result += 3;
        else if (runLength > 5) result++;
      } else {
        finderPenaltyAdd(runLength, history, size);
        if (!runColor) result += finderPenaltyCount(history) * 40;
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    result += finderPenaltyFinish(runColor, runLength, history, size) * 40;
  }

  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runLength = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (modules[y][x] === runColor) {
        runLength++;
        if (runLength === 5) result += 3;
        else if (runLength > 5) result++;
      } else {
        finderPenaltyAdd(runLength, history, size);
        if (!runColor) result += finderPenaltyCount(history) * 40;
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    result += finderPenaltyFinish(runColor, runLength, history, size) * 40;
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        result += 3;
      }
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
    }
  }
  const total = size * size;
  const balance = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + balance * 10;
}

interface QrResult {
  size: number;
  version: number;
  modules: boolean[][];
  mask: number;
  byteLength: number;
  capacity: number;
}

function encodeQr(text: string, ecc: EccLevel): QrResult | null {
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 0;
  let capacityBits = 0;
  for (let v = 1; v <= 40; v++) {
    const available = dataCodewords(v, ecc) * 8;
    const needed = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= available) {
      version = v;
      capacityBits = available;
      break;
    }
  }
  if (version === 0) return null;

  const bits: number[] = [];
  appendBits(0b0100, 4, bits);
  appendBits(bytes.length, version <= 9 ? 8 : 16, bits);
  for (const byte of bytes) appendBits(byte, 8, bits);

  appendBits(0, Math.min(4, capacityBits - bits.length), bits);
  appendBits(0, (8 - (bits.length % 8)) % 8, bits);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(pad, 8, bits);
  }

  const codewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    codewords[i >>> 3] |= bit << (7 - (i & 7));
  });

  const allCodewords = interleave(codewords, version, ecc);

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  };

  const drawAlignment = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };

  const drawFormat = (mask: number) => {
    const value = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = (((value << 10) | rem) ^ 0x5412) & 0x7fff;

    for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(formatBits, i));
    setFunction(8, 7, getBit(formatBits, 6));
    setFunction(8, 8, getBit(formatBits, 7));
    setFunction(7, 8, getBit(formatBits, 8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(formatBits, i));

    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(formatBits, i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(formatBits, i));
    setFunction(8, size - 8, true);
  };

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  const positions = alignmentPositions(version);
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const skip =
        (i === 0 && j === 0) ||
        (i === 0 && j === positions.length - 1) ||
        (i === positions.length - 1 && j === 0);
      if (!skip) drawAlignment(positions[i], positions[j]);
    }
  }

  drawFormat(0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const versionBits = ((version << 12) | rem) & 0x3ffff;
    for (let i = 0; i < 18; i++) {
      const dark = getBit(versionBits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, dark);
      setFunction(b, a, dark);
    }
  }

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!reserved[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7));
          bitIndex++;
        }
      }
    }
  }

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
    drawFormat(mask);
    const penalty = penaltyScore(modules, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && maskBit(bestMask, x, y)) modules[y][x] = !modules[y][x];
    }
  }
  drawFormat(bestMask);

  return {
    size,
    version,
    modules,
    mask: bestMask,
    byteLength: bytes.length,
    capacity: Math.floor(capacityBits / 8),
  };
}

const QUIET_ZONE = 4;

function buildPath(modules: boolean[][], size: number): string {
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) {
        parts.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }
  return parts.join("");
}

function buildSvg(modules: boolean[][], size: number): string {
  const total = size + QUIET_ZONE * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="#ffffff"/>`,
    `<path fill="#000000" d="${buildPath(modules, size)}"/>`,
    `</svg>`,
  ].join("");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function QrCodeGenerator() {
  const [text, setText] = useState("");
  const [ecc, setEcc] = useState<EccLevel>("M");
  const [pngSize, setPngSize] = useState("512");

  const result = useMemo(() => {
    if (text === "") return null;
    try {
      return encodeQr(text, ecc);
    } catch {
      return null;
    }
  }, [text, ecc]);

  const tooLong = text !== "" && result === null;
  const svgMarkup = result ? buildSvg(result.modules, result.size) : "";

  const downloadPng = () => {
    if (!result) return;
    const total = result.size + QUIET_ZONE * 2;
    const requested = Number.parseInt(pngSize, 10);
    const target = Number.isFinite(requested) ? Math.min(Math.max(requested, 64), 4096) : 512;
    const scale = Math.max(1, Math.round(target / total));
    const canvas = document.createElement("canvas");
    canvas.width = total * scale;
    canvas.height = total * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < result.size; y++) {
      for (let x = 0; x < result.size; x++) {
        if (result.modules[y][x]) {
          ctx.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale);
        }
      }
    }
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, "qr-code.png");
    }, "image/png");
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    downloadBlob(new Blob([svgMarkup], { type: "image/svg+xml" }), "qr-code.svg");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <ToolTextarea
        label="Text or URL"
        placeholder="https://ctrlcat.dev"
        hint="Everything is encoded in your browser. Nothing is uploaded."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
          Error correction
        </span>
        <div className="flex flex-wrap gap-2">
          {ECC_LEVELS.map((level) => (
            <ToolButton
              key={level}
              size="sm"
              variant={ecc === level ? "primary" : "ghost"}
              onClick={() => setEcc(level)}
            >
              {level}
            </ToolButton>
          ))}
        </div>
        <span className="text-xs text-tool-text-dim">
          Level {ecc} can still be read with {ECC_RECOVERY[ecc]} of the code damaged.
        </span>
      </div>

      {tooLong && (
        <div className="rounded-lg border border-tool-border bg-tool-surface p-4 text-sm text-tool-text">
          This text is too long for a single QR code at level {ecc}. Shorten it, or pick a lower
          error correction level.
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Version" value={result.version} accent />
            <StatCard label="Grid" value={`${result.size} x ${result.size}`} sub="modules" />
            <StatCard label="Bytes used" value={`${result.byteLength} / ${result.capacity}`} />
            <StatCard label="Mask" value={result.mask} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
                QR code
              </span>
              <CopyButton text={svgMarkup} />
            </div>
            <div className="flex justify-center rounded-lg border border-tool-border bg-tool-surface p-6">
              <svg
                viewBox={`0 0 ${result.size + QUIET_ZONE * 2} ${result.size + QUIET_ZONE * 2}`}
                className="h-auto w-full max-w-xs"
                shapeRendering="crispEdges"
                role="img"
                aria-label="Generated QR code"
              >
                <rect
                  width={result.size + QUIET_ZONE * 2}
                  height={result.size + QUIET_ZONE * 2}
                  fill="#ffffff"
                />
                <path fill="#000000" d={buildPath(result.modules, result.size)} />
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <ToolInput
                label="PNG size"
                suffix="px"
                type="number"
                min={64}
                max={4096}
                value={pngSize}
                onChange={(e) => setPngSize(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={downloadPng}>Download PNG</ToolButton>
              <ToolButton variant="secondary" onClick={downloadSvg}>
                Download SVG
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => setText("")}>
                Clear
              </ToolButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
