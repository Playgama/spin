// QR code encoder: byte mode, error correction level M, versions 1–10 (up to 213 bytes), the best of
// the eight masks. Returns the code as rows of booleans, dark = true, without the quiet zone.
// Follows ISO/IEC 18004; laid out like Project Nayuki's reference encoder.

// Level M, by version: error correction codewords per block, and the number of blocks.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const bit = (value, i) => ((value >>> i) & 1) === 1;

// Codewords a version holds, data and error correction together.
function codewords(version) {
  let bits = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const aligns = Math.floor(version / 7) + 2;
    bits -= (25 * aligns - 10) * aligns - 55;
    if (version >= 7) bits -= 36;
  }
  return bits >> 3;
}

// Reed–Solomon over GF(2^8), polynomial 0x11D.
function multiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function remainder(data, div) {
  const result = div.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    div.forEach((coef, i) => { result[i] ^= multiply(coef, factor); });
  }
  return result;
}

// How hard a masked code is to read: long runs, 2×2 blocks, finder look-alikes, uneven fill.
function penalty(dark) {
  const size = dark.length;
  let score = 0;
  let filled = 0;
  for (let i = 0; i < size; i++) {
    for (const line of [dark[i].map(Number).join(''), dark.map((row) => Number(row[i])).join('')]) {
      for (const run of line.match(/0+|1+/g)) if (run.length >= 5) score += run.length - 2;
      score += 40 * (line.split('10111010000').length + line.split('00001011101').length - 2);
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dark[y][x]) filled++;
      if (x + 1 < size && y + 1 < size && dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) score += 3;
    }
  }
  return score + 10 * Math.max(0, Math.ceil(Math.abs(filled * 20 - size * size * 10) / (size * size)) - 1);
}

export function qr(text) {
  const bytes = new TextEncoder().encode(text);
  const lengthBits = (v) => (v < 10 ? 8 : 16);
  const capacity = (v) => codewords(v) - ECC_PER_BLOCK[v] * BLOCKS[v]; // data codewords
  let version = 1;
  while (4 + lengthBits(version) + bytes.length * 8 > capacity(version) * 8) {
    if (++version > 10) throw new Error('Too long for a QR code');
  }

  // Data codewords: mode, length, the bytes, a terminator, then padding.
  const bits = [];
  const push = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  const room = capacity(version) * 8;
  push(4, 4);
  push(bytes.length, lengthBits(version));
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, room - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < room; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Split into blocks, add error correction to each, interleave.
  const blocks = BLOCKS[version];
  const ecc = ECC_PER_BLOCK[version];
  const shortBlocks = blocks - (codewords(version) % blocks);
  const shortLength = Math.floor(codewords(version) / blocks);
  const div = divisor(ecc);
  const parts = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const part = data.slice(k, k + shortLength - ecc + (i < shortBlocks ? 0 : 1));
    k += part.length;
    const check = remainder(part, div);
    if (i < shortBlocks) part.push(0);
    parts.push(part.concat(check));
  }
  const stream = [];
  for (let i = 0; i < parts[0].length; i++) {
    parts.forEach((part, j) => {
      if (i !== shortLength - ecc || j >= shortBlocks) stream.push(part[i]);
    });
  }

  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false)); // not data: never masked
  const set = (x, y, on) => {
    dark[y][x] = on;
    fixed[y][x] = true;
  };

  // Timing lines, the three finders with their separators, the alignment marks.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, ring !== 2 && ring !== 4);
      }
    }
  }
  const aligns = [];
  if (version > 1) {
    const count = Math.floor(version / 7) + 2;
    const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    for (let pos = size - 7; aligns.length < count - 1; pos -= step) aligns.unshift(pos);
    aligns.unshift(6);
  }
  const last = aligns.length - 1;
  aligns.forEach((x, i) => aligns.forEach((y, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return; // a finder is there
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));

  // Format: the level (M is 00) and the mask, with 10 check bits, twice.
  const format = (mask) => {
    let rem = mask;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const value = ((mask << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(value, i));
    set(8, 7, bit(value, 6));
    set(8, 8, bit(value, 7));
    set(7, 8, bit(value, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(value, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(value, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(value, i));
    set(8, size - 8, true);
  };
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const value = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(value, i));
      set(b, a, bit(value, i));
    }
  }

  // The codewords snake up and down in two-module columns, from the right.
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (fixed[y][x] || n >= stream.length * 8) continue;
        dark[y][x] = bit(stream[n >>> 3], 7 - (n & 7));
        n++;
      }
    }
  }

  // Try every mask, keep the easiest one to read.
  const flip = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[mask](x, y)) dark[y][x] = !dark[y][x];
    }
  };
  let best = 0;
  let least = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    flip(mask);
    format(mask);
    const score = penalty(dark);
    if (score < least) [least, best] = [score, mask];
    flip(mask);
  }
  flip(best);
  format(best);
  return dark;
}
