/* QR Code Model 2 encoder, byte mode only. Follows the structure of Project Nayuki's
   reference implementation (ISO/IEC 18004). */

export type EccLevel = "L" | "M" | "Q" | "H";

const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

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
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
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
  return Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[ecc][version] * ECC_BLOCK_COUNT[ecc][version];
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

function appendBits(value: number, length: number, bits: number[]): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

const getBit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
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
  for (let i = 0, offset = 0; i < blockCount; i++) {
    const length = shortBlockLen - blockEccLen + (i < shortBlockCount ? 0 : 1);
    const chunk = data.slice(offset, offset + length);
    offset += length;
    const parity = rsRemainder(chunk, divisor);
    if (i < shortBlockCount) chunk.push(0);
    blocks.push(chunk.concat(parity));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= shortBlockCount) result.push(blocks[j][i]);
    }
  }
  return result;
}

function finderPenaltyCount(history: number[]): number {
  const n = history[1];
  const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
  return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
}

function finderPenaltyAdd(runLength: number, history: number[], size: number): void {
  history.pop();
  history.unshift(history[0] === 0 ? runLength + size : runLength);
}

/** Penalty for one row or column; `at(k)` reads module k along the line. */
function linePenalty(at: (k: number) => boolean, size: number): number {
  let result = 0;
  let runColor = false;
  let runLength = 0;
  const history = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < size; k++) {
    if (at(k) === runColor) {
      runLength++;
      if (runLength === 5) result += 3;
      else if (runLength > 5) result++;
    } else {
      finderPenaltyAdd(runLength, history, size);
      if (!runColor) result += finderPenaltyCount(history) * 40;
      runColor = at(k);
      runLength = 1;
    }
  }
  if (runColor) {
    finderPenaltyAdd(runLength, history, size);
    runLength = 0;
  }
  finderPenaltyAdd(runLength + size, history, size);
  return result + finderPenaltyCount(history) * 40;
}

function penaltyScore(modules: boolean[][], size: number): number {
  let result = 0;
  for (let i = 0; i < size; i++) {
    result += linePenalty((k) => modules[i][k], size);
    result += linePenalty((k) => modules[k][i], size);
  }

  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (
        y < size - 1 &&
        x < size - 1 &&
        modules[y][x] === modules[y][x + 1] &&
        modules[y][x] === modules[y + 1][x] &&
        modules[y][x] === modules[y + 1][x + 1]
      ) {
        result += 3;
      }
    }
  }
  const total = size * size;
  return result + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

export interface QrCode {
  size: number;
  version: number;
  modules: boolean[][];
  mask: number;
  byteLength: number;
  capacity: number;
}

/** Returns null when the text does not fit in a version-40 symbol at this level. */
export function encodeQr(text: string, ecc: EccLevel): QrCode | null {
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 0;
  let capacityBits = 0;
  for (let v = 1; v <= 40; v++) {
    const available = dataCodewords(v, ecc) * 8;
    if (4 + (v <= 9 ? 8 : 16) + bytes.length * 8 <= available) {
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
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8, bits);

  const codewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    codewords[i >>> 3] |= bit << (7 - (i & 7));
  });
  const allCodewords = interleave(codewords, version, ecc);

  const size = version * 4 + 17;
  const grid = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const modules = grid();
  const reserved = grid();

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
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  };

  const drawAlignment = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
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

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((px, i) =>
    positions.forEach((py, j) => {
      const overlapsFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!overlapsFinder) drawAlignment(px, py);
    }),
  );

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
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
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
    applyMask(mask);
    drawFormat(mask);
    const penalty = penaltyScore(modules, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    applyMask(mask);
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return { size, version, modules, mask: bestMask, byteLength: bytes.length, capacity: Math.floor(capacityBits / 8) };
}
