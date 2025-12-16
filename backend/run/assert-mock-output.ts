import fs from 'node:fs';
import path from 'node:path';
import { computeDashboard } from '../dashboard/computeDashboard';
import type { YYYYMM } from '../dashboard/types';
import { createMockClickUpClient, createMockInstagramClient, mockComputedAt } from './mockDeps';

function parseMonth(): YYYYMM {
  const envMonth = process.env.F1_MONTH;
  if (envMonth) return envMonth as YYYYMM;

  const arg = process.argv.find((a) => a.startsWith('--month='));
  if (arg) return arg.split('=')[1] as YYYYMM;

  return '2025-12' as YYYYMM;
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
  const month = parseMonth();
  const update = process.argv.includes('--update');

  const clickup = createMockClickUpClient();
  const instagram = createMockInstagramClient();

  const actual = await computeDashboard(month, {
    clickup,
    instagram,
    computedAt: mockComputedAt(),
  });

  const actualText = stableStringify(actual);

  const expectedPath = path.resolve(process.cwd(), 'backend', 'fixtures', `expected-dashboard-${month}.json`);

  if (update) {
    fs.writeFileSync(expectedPath, actualText, 'utf8');
    process.stdout.write(`Updated snapshot: ${expectedPath}\n`);
    return;
  }

  if (!fs.existsSync(expectedPath)) {
    throw new Error(
      `Missing expected snapshot for ${month}: ${expectedPath}. Run with --update to create it.`,
    );
  }

  const expectedText = fs.readFileSync(expectedPath, 'utf8');

  if (expectedText === actualText) {
    process.stdout.write('OK: mock output matches expected snapshot.\n');
    return;
  }

  const idx = firstDiffIndex(expectedText, actualText);
  const contextStart = Math.max(0, idx - 120);
  const contextEnd = idx + 120;

  const expectedContext = expectedText.slice(contextStart, contextEnd);
  const actualContext = actualText.slice(contextStart, contextEnd);

  throw new Error(
    `Mock output differs from expected snapshot at index ${idx}.\n\n` +
      `Expected context:\n${expectedContext}\n\n` +
      `Actual context:\n${actualContext}\n\n` +
      `If this change is intentional, regenerate with: node dist-backend/run/assert-mock-output.js --update (or set F1_MONTH).\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
