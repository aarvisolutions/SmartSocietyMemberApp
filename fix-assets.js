const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcIn = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([lenBuf, crcIn, crcBuf]);
}

function createSolidPNG(width, height, r, g, b) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const rowLen = width * 3 + 1;
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      raw[y * rowLen + 1 + x * 3]     = r;
      raw[y * rowLen + 1 + x * 3 + 1] = g;
      raw[y * rowLen + 1 + x * 3 + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// #1e3a8a = rgb(30, 58, 138)
const blue = createSolidPNG(1024, 1024, 30, 58, 138);
fs.writeFileSync('assets/icon.png', blue);
fs.writeFileSync('assets/adaptive-icon.png', blue);

// Splash: white background with blue tint
const splash = createSolidPNG(1284, 2778, 30, 58, 138);
fs.writeFileSync('assets/splash.png', splash);

console.log('Assets fixed:');
['icon.png','adaptive-icon.png','splash.png'].forEach(f => {
  console.log(' ', f, fs.statSync('assets/'+f).size, 'bytes');
});
