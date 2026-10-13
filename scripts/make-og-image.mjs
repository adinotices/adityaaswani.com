// Generates public/og-default.jpg (1200x630) from the full-size portrait, which lives outside
// public/ (assets/source/) so the 13.5 MB original is never published (AA-24).
// Run once after changing the photo: node scripts/make-og-image.mjs
import sharp from 'sharp';
import { statSync } from 'node:fs';

const SRC = 'assets/source/aditya-photo-new.jpg'; // 4050x6000 portrait
const OUT = 'public/og-default.jpg';
const W = 1200, H = 630;
// Full width of the photo, a 1200:630 band framing the head and chin.
const width = 4050, height = Math.round((width * H) / W), top = 950;

await sharp(SRC)
  .extract({ left: 0, top, width, height })
  .resize(W, H)
  .jpeg({ quality: 78, mozjpeg: true, progressive: true })
  .toFile(OUT);

const kb = statSync(OUT).size / 1024;
if (kb >= 300) throw new Error(`${OUT} is ${kb.toFixed(0)} KB, over the 300 KB budget`);
console.log(`${OUT}: ${W}x${H}, ${kb.toFixed(0)} KB`);
