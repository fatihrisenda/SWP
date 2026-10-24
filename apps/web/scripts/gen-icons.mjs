/**
 * Pembangkit aset ikon PWA (Issue 052 langkah 1).
 *
 * Sumber bentuk = vektor launcher lama (`legacy/android-app/app/src/main/res/drawable/ic_launcher_*.xml`):
 * kotak biru + papan tugas bercentang. Ditulis ulang di sini sebagai rasterizer kecil
 * supaya repo tidak perlu dependensi gambar (sharp/@resvg) hanya untuk lima berkas statis.
 * Hasil identik dengan yang diharapkan generator `@vite-pwa/assets-generator`:
 *   public/icons/icon-192.png, icon-512.png, maskable-512.png, badge-72.png
 *   public/apple-touch-icon.png
 *
 * Jalankan: npm run icons -w apps/web
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const VIEW = 108;
const SAMPLES = 4;
const SAMPLE_COUNT = SAMPLES * SAMPLES;

const INK = {
  blue: [0x25, 0x63, 0xeb],
  blueDark: [0x1d, 0x4e, 0xd8],
  navy: [0x1e, 0x3a, 0x8a],
  white: [0xff, 0xff, 0xff],
  amber: [0xfa, 0xcc, 0x15],
};

/* ---------------------------------- bentuk --------------------------------- */

/** Jarak bertanda negatif di dalam persegi panjang bersudut kumul. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const dx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const dy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function inRoundRect(px, py, x, y, w, h, r) {
  return sdRoundRect(px, py, x, y, w, h, r) <= 0;
}

function inPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function inStroke(px, py, pts, width) {
  const half = width / 2;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(px, py, pts[i - 1], pts[i]) <= half) return true;
  }
  return false;
}

const BG = { x: 0, y: 0, w: VIEW, h: VIEW, r: 24 };
const CLIPBOARD = { x: 33, y: 32, w: 42, h: 48, r: 5 };
const CLIP = { x: 42, y: 27, w: 24, h: 11, r: 3 };
const CHECK = [
  [42, 57],
  [50, 65],
  [65, 48],
];
const CHECK_WIDTH = 5;
const SPARKLE = [
  [72, 66],
  [74.2, 71.3],
  [79.5, 73.5],
  [74.2, 75.7],
  [72, 81],
  [69.8, 75.7],
  [64.5, 73.5],
  [69.8, 71.3],
];
const BAND = [
  [0, 70],
  [VIEW, 40],
  [VIEW, VIEW],
  [0, VIEW],
];

/* -------------------------------- renderer --------------------------------- */

/**
 * @param spec {{size:number, mask:'rounded'|'square', logoScale:number, badge:boolean}}
 * @returns {Buffer} PNG RGBA
 */
function renderIcon(spec) {
  const { size, mask, logoScale, badge } = spec;
  const step = VIEW / size;
  const sub = step / SAMPLES;
  const cx = VIEW / 2;
  const cy = VIEW / 2;

  /** Warna akhir pada satu titik uji (ruang vektor 108), sebagai [r,g,b,a] 0-255. */
  function paint(px, py) {
    // Latar: penuh untuk square/maskable/apple, berkumul untuk ikon "any".
    const inBg = mask === 'square' ? px >= 0 && py >= 0 && px < VIEW && py < VIEW : inRoundRect(px, py, BG.x, BG.y, BG.w, BG.h, BG.r);
    if (badge) {
      // Lencana Android: siluet putih, centang dilubangi (kanal alpha saja yang dipakai).
      const lx = cx + (px - cx) / logoScale;
      const ly = cy + (py - cy) / logoScale;
      if (!inRoundRect(lx, ly, CLIPBOARD.x, CLIPBOARD.y, CLIPBOARD.w, CLIPBOARD.h, CLIPBOARD.r)) return null;
      if (inStroke(lx, ly, CHECK, CHECK_WIDTH)) return null;
      return [255, 255, 255, 255];
    }
    if (!inBg) return null;
    // Pita diagonal hanya latar: kelompok logo selalu di atasnya (sama seperti urutan di SVG).
    const background = inPolygon(px, py, BAND) ? INK.blueDark : INK.blue;
    // Kelompok logo diperkecil (zona aman maskable / inset apple-touch) via pemetaan titik.
    const lx = cx + (px - cx) / logoScale;
    const ly = cy + (py - cy) / logoScale;
    if (inStroke(lx, ly, CHECK, CHECK_WIDTH)) return [...INK.blue, 255];
    if (inPolygon(lx, ly, SPARKLE)) return [...INK.amber, 255];
    if (inRoundRect(lx, ly, CLIP.x, CLIP.y, CLIP.w, CLIP.h, CLIP.r)) return [...INK.navy, 255];
    if (inRoundRect(lx, ly, CLIPBOARD.x, CLIPBOARD.y, CLIPBOARD.w, CLIPBOARD.h, CLIPBOARD.r)) return [...INK.white, 255];
    return [...background, 255];
  }

  const rgba = Buffer.alloc(size * size * 4);
  let o = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Supersampling dengan akumulasi pre-multiplied agar tepi kumul & stroke tetap halus.
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      const oy = (y + 0.5) * step;
      const ox = (x + 0.5) * step;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = paint(ox + (sx + 0.5) * sub, oy + (sy + 0.5) * sub);
          if (!c) continue;
          const a = c[3];
          sumR += c[0] * a;
          sumG += c[1] * a;
          sumB += c[2] * a;
          sumA += a;
        }
      }
      const alpha = sumA / SAMPLE_COUNT;
      if (sumA === 0) {
        rgba[o] = 0;
        rgba[o + 1] = 0;
        rgba[o + 2] = 0;
        rgba[o + 3] = 0;
      } else {
        rgba[o] = Math.round(sumR / sumA);
        rgba[o + 1] = Math.round(sumG / sumA);
        rgba[o + 2] = Math.round(sumB / sumA);
        rgba[o + 3] = Math.round(alpha);
      }
      o += 4;
    }
  }
  return encodePng(size, size, rgba);
}

/* ------------------------------- PNG encoder ------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter "None"
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // warna RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------- output --------------------------------- */

const TARGETS = [
  { file: 'icons/icon-192.png', size: 192, mask: 'rounded', logoScale: 1, badge: false },
  { file: 'icons/icon-512.png', size: 512, mask: 'rounded', logoScale: 1, badge: false },
  // Maskable: latar penuh, logo dikecilkan ke zona aman 80 %.
  { file: 'icons/maskable-512.png', size: 512, mask: 'square', logoScale: 0.8, badge: false },
  // Apple tidak merender kanal alpha: kotak penuh opaque, logo sedikit masuk dari tepi.
  { file: 'apple-touch-icon.png', size: 180, mask: 'square', logoScale: 0.88, badge: false },
  { file: 'icons/badge-72.png', size: 72, mask: 'square', logoScale: 0.9, badge: true },
];

for (const target of TARGETS) {
  const out = join(PUBLIC, target.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderIcon(target));
  console.log(`ikon ditulis: public/${target.file} (${target.size}x${target.size})`);
}
