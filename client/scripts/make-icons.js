import fs from "node:fs";
import zlib from "node:zlib";
import { Buffer } from "node:buffer";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5, size);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [79, 70, 229];

function coverage(dist, half) {
  return Math.min(1, Math.max(0, half - dist + 0.5));
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function icon(x, y, size) {
  const u = x / size;
  const v = y / size;
  const ring = Math.abs(Math.hypot(u - 0.5, v - 0.5) - 0.3) * size;
  let white = coverage(ring, 0.035 * size);
  const tick = Math.min(
    segDist(u, v, 0.37, 0.52, 0.46, 0.61) * size,
    segDist(u, v, 0.46, 0.61, 0.64, 0.4) * size,
  );
  white = Math.max(white, coverage(tick, 0.03 * size));
  const mix = (c) => Math.round(c + (255 - c) * white);
  return [mix(BG[0]), mix(BG[1]), mix(BG[2]), 255];
}

const dir = new URL("../public/icons/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(new URL("icon-192.png", dir), png(192, icon));
fs.writeFileSync(new URL("icon-512.png", dir), png(512, icon));
fs.writeFileSync(new URL("apple-touch-icon.png", dir), png(180, icon));
console.log("Icons written to client/public/icons");
