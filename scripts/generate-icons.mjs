// Generates the PWA and Apple icons from one SVG.
// Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0b0d10";
const ACCENT = "#c6f432";

// Dumbbell centred in a 512 box. `scale` shrinks it for maskable icons,
// whose outer ~20% may be cropped by the launcher.
function svg({ scale = 1, rounded = true } = {}) {
  const radius = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="${ACCENT}">
    <rect x="96" y="160" width="56" height="192" rx="20"/>
    <rect x="360" y="160" width="56" height="192" rx="20"/>
    <rect x="48" y="204" width="40" height="104" rx="16"/>
    <rect x="424" y="204" width="40" height="104" rx="16"/>
    <rect x="152" y="236" width="208" height="40" rx="12"/>
  </g>
</svg>`;
}

async function png(svgText, size, path) {
  await writeFile(path, await sharp(Buffer.from(svgText)).resize(size, size).png().toBuffer());
  console.log("wrote", path);
}

await mkdir("public/icons", { recursive: true });
await png(svg(), 192, "public/icons/icon-192.png");
await png(svg(), 512, "public/icons/icon-512.png");
await png(svg({ scale: 0.7, rounded: false }), 512, "public/icons/icon-maskable-512.png");
await png(svg({ rounded: false }), 180, "src/app/apple-icon.png");
await png(svg(), 48, "src/app/icon.png");
