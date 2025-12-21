const fs = require('node:fs');
const path = require('node:path');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const distBackend = path.join(repoRoot, 'dist', 'engine');

  if (!fs.existsSync(distBackend)) {
    throw new Error(
      `Missing ${distBackend}. Build backend first (from repo root): npm run f1:build`,
    );
  }

  // Runtime location (sibling of lib/). This allows compiled JS under lib/**
  // to resolve engine modules via ../../engine/...
  const out = path.join(__dirname, '..', 'engine');
  rmrf(out);
  copyDir(distBackend, out);

  process.stdout.write(`Copied backend engine into functions/engine from ${distBackend}\n`);
}

main();
