import fs from 'node:fs';
import path from 'node:path';
import { computeDashboard } from '../dashboard/computeDashboard';
import type { YYYYMM } from '../dashboard/types';
import { generateSnapshotRecords } from '../snapshots/generateSnapshotRecords';
import { createMockClickUpClient, createMockInstagramClient, mockComputedAt } from './mockDeps';

function parseMonths(): YYYYMM[] {
  const envMonths = process.env.F2_MONTHS;
  if (envMonths) {
    return envMonths.split(',').map((m) => m.trim() as YYYYMM).filter(Boolean);
  }

  const arg = process.argv.find((a) => a.startsWith('--months='));
  if (arg) {
    const list = arg.split('=')[1];
    return list.split(',').map((m) => m.trim() as YYYYMM).filter(Boolean);
  }

  return ['2025-10', '2025-11', '2025-12'] as YYYYMM[];
}

function snapshotFileName(months: YYYYMM[]): string {
  const first = months[0];
  const last = months[months.length - 1];
  return `expected-snapshots-${first}_to_${last}.json`;
}

function stableStringify(value: unknown, indent = 2): string {
  function normalize(v: unknown): unknown {
    if (v === null) return null;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        out[key] = normalize(obj[key]);
      }
      return out;
    }
    return v;
  }

  return JSON.stringify(normalize(value), null, indent) + '\n';
}

function firstDiffIndex(a: string, b: string): number {
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : min;
}

async function main(): Promise<void> {
  const months = parseMonths().slice().sort();
  const update = process.argv.includes('--update');

  const clickup = createMockClickUpClient();
  const instagram = createMockInstagramClient();
  const computedAt = mockComputedAt();

  const records = await generateSnapshotRecords({
    months,
    computedAt,
    computeDashboard: (month) => computeDashboard(month, { clickup, instagram, computedAt }),
  });

  const actualText = stableStringify(records);

  const expectedPath = path.resolve(process.cwd(), 'backend', 'fixtures', snapshotFileName(months));

  if (update) {
    fs.writeFileSync(expectedPath, actualText, 'utf8');
    process.stdout.write(`Updated snapshot: ${expectedPath}\n`);
    return;
  }

  if (!fs.existsSync(expectedPath)) {
    throw new Error(`Missing expected snapshot: ${expectedPath}. Run with --update to create it.`);
  }

  const expectedText = fs.readFileSync(expectedPath, 'utf8');

  if (expectedText === actualText) {
    process.stdout.write('OK: snapshot output matches expected.\n');
    return;
  }

  const idx = firstDiffIndex(expectedText, actualText);
  const contextStart = Math.max(0, idx - 120);
  const contextEnd = idx + 120;

  throw new Error(
    `Snapshot output differs from expected at index ${idx}.\n\n` +
      `Expected context:\n${expectedText.slice(contextStart, contextEnd)}\n\n` +
      `Actual context:\n${actualText.slice(contextStart, contextEnd)}\n\n` +
      `If intentional, regenerate with: node dist/engine/run/assert-snapshots-mock.js --update\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
