import fs from "fs";
import zlib from "zlib";

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, toCrc, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Raw image data: for each row, 1 filter byte (0) + width * 4 bytes (RGBA)
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background badge: Forest Green #1f3a33 with slight border
      if (dist <= radius) {
        // Inner circle or symbol: Crane / truck / letter
        const innerBorder = Math.abs(dist - radius) < (size * 0.03);
        if (innerBorder) {
          // Gold border #d97706
          rawData[pxOffset] = 217;
          rawData[pxOffset + 1] = 119;
          rawData[pxOffset + 2] = 6;
          rawData[pxOffset + 3] = 255;
        } else {
          // Saban green #1f3a33
          // Let's draw a stylized "ח. סבן" truck / disk motif in the center
          const isCenterBox = Math.abs(dx) < size * 0.22 && Math.abs(dy) < size * 0.18;
          const isWheel1 = Math.hypot(dx - size * 0.12, dy - size * 0.18) < size * 0.07;
          const isWheel2 = Math.hypot(dx + size * 0.12, dy - size * 0.18) < size * 0.07;
          const isCraneArm = Math.abs(dx + dy * 0.7) < (size * 0.03) && dy < 0 && dy > -size * 0.35 && dx < size * 0.25;

          if (isWheel1 || isWheel2) {
            // Wheels
            rawData[pxOffset] = 245;
            rawData[pxOffset + 1] = 158;
            rawData[pxOffset + 2] = 11;
            rawData[pxOffset + 3] = 255;
          } else if (isCraneArm) {
            // Crane arm in amber
            rawData[pxOffset] = 251;
            rawData[pxOffset + 1] = 191;
            rawData[pxOffset + 2] = 36;
            rawData[pxOffset + 3] = 255;
          } else if (isCenterBox && dy < size * 0.12) {
            // Truck body
            rawData[pxOffset] = 255;
            rawData[pxOffset + 1] = 255;
            rawData[pxOffset + 2] = 255;
            rawData[pxOffset + 3] = 240;
          } else {
            // Background
            rawData[pxOffset] = 31;
            rawData[pxOffset + 1] = 58;
            rawData[pxOffset + 2] = 51;
            rawData[pxOffset + 3] = 255;
          }
        }
      } else {
        // Transparent outside
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk("IHDR", ihdr);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync("public/icon-512.png", generatePng(512));
fs.writeFileSync("public/icon-192.png", generatePng(192));
console.log("Generated public/icon-512.png and public/icon-192.png successfully");
