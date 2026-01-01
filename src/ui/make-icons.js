// make-icons.js
// Generates rounded-corner app icons from a source logo in /public.
// Run via: npm run make:icons

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('png-to-ico');

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
// Radius is specified as a "design" value (CORNER_ROUNDNESS_AT_BASE), then scaled per output size.
// Using a larger base makes the corners less rounded at the same CORNER value.
const BASE_SIZE_FOR_RADIUS = 1024;
const CORNER_ROUNDNESS_AT_BASE = 70;

function pickSourceLogo() {
  const candidates = [path.resolve('public/logo.png'), path.resolve('public/applogo.png')];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Source logo not found. Expected one of: ${candidates.join(', ')}`);
}

function roundedMaskSvg(size, cornerRadius) {
  const r = Math.max(0, Math.min(cornerRadius, Math.floor(size / 2)));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}"/>` +
    `</svg>`,
  );
}

async function makeRoundedIcon(src, size, outPath) {
  const scaledRadius = Math.round((CORNER_ROUNDNESS_AT_BASE * size) / BASE_SIZE_FOR_RADIUS);
  const mask = roundedMaskSvg(size, scaledRadius);

  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(outPath);
}

(async () => {
  const src = pickSourceLogo();
  const outDir = path.resolve('public/images/app-icons');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(
    `Corner roundness: ${CORNER_ROUNDNESS_AT_BASE} @ base ${BASE_SIZE_FOR_RADIUS} -> ` +
      SIZES.map((s) => `${s}px:r${Math.round((CORNER_ROUNDNESS_AT_BASE * s) / BASE_SIZE_FOR_RADIUS)}`).join(', '),
  );

  await Promise.all(
    SIZES.map((s) => makeRoundedIcon(src, s, path.join(outDir, `icon-${s}.png`))),
  );

  // A convenient "app logo" PNG for UI usage
  fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.resolve('public/applogo-rounded.png'));

  // ICO for Windows (<=256px)
  const icoBuf = await toIco(SIZES.filter((s) => s <= 256).map((s) => path.join(outDir, `icon-${s}.png`)));
  fs.writeFileSync(path.join(outDir, 'app.ico'), icoBuf);

  // Favicon used by the renderer (Chrome/Electron) when opening the app.
  fs.writeFileSync(path.resolve('public/favicon.ico'), icoBuf);

  console.log(`✔ icons ready in ${outDir}`);
  console.log('✔ rounded logo ready at public/applogo-rounded.png');
})();
