import type { SnapshotRecord } from '@/lib/snapshots/types';
import * as XLSX from 'xlsx';
import { assertExportRowsMatchSnapshot, snapshotToExportRows } from '@/export/rows';

function round2(v: number | null): number | null {
  if (v == null) return null;
  if (!Number.isFinite(v)) return null;
  return Number(v.toFixed(2));
}

function validateRawSheet(arrayBuffer: ArrayBuffer, expectedRawAoA: any[][]) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets['Raw'];
  if (!sheet) throw new Error('XLSX validation failed: missing Raw sheet');
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];

  if (aoa.length !== expectedRawAoA.length) {
    throw new Error(`XLSX validation failed: Raw row count mismatch (${aoa.length} vs ${expectedRawAoA.length})`);
  }

  for (let r = 0; r < expectedRawAoA.length; r++) {
    const exp = expectedRawAoA[r];
    const got = aoa[r] ?? [];
    // Compare key columns deterministically.
    if (String(got[0] ?? '') !== String(exp[0] ?? '')) throw new Error(`XLSX validation failed: Raw row ${r} month mismatch`);
    if (String(got[3] ?? '') !== String(exp[3] ?? '')) throw new Error(`XLSX validation failed: Raw row ${r} metricKey mismatch`);

    const expValue = exp[6];
    const gotValue = got[6];
    if ((expValue ?? null) !== (gotValue ?? null)) {
      throw new Error(`XLSX validation failed: Raw row ${r} value mismatch for ${String(exp[3])}`);
    }

    const expDiff = exp[8];
    const gotDiff = got[8];
    if ((expDiff ?? null) !== (gotDiff ?? null)) {
      throw new Error(`XLSX validation failed: Raw row ${r} diff mismatch for ${String(exp[3])}`);
    }
  }
}

export function exportSnapshotToXlsx(snapshot: SnapshotRecord): ArrayBuffer {
  const rows = snapshotToExportRows(snapshot);
  assertExportRowsMatchSnapshot(snapshot, rows);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Snapshot (human readable)
  const snapshotAoA: any[][] = [];
  snapshotAoA.push(['Ziv Cocktails — Monthly Snapshot']);
  snapshotAoA.push(['Month', snapshot.month]);
  snapshotAoA.push(['Computed at', snapshot.computedAt]);
  snapshotAoA.push([]);

  const categories: Array<{ name: string; rows: typeof rows }> = [
    { name: 'Financial', rows: rows.filter((r) => r.category === 'Financial') },
    { name: 'Marketing', rows: rows.filter((r) => r.category === 'Marketing') },
    { name: 'Sales', rows: rows.filter((r) => r.category === 'Sales') },
    { name: 'Operations', rows: rows.filter((r) => r.category === 'Operations') },
  ];

  for (const c of categories) {
    snapshotAoA.push([c.name]);
    snapshotAoA.push(['Metric', 'Value', 'MoM diff %']);
    for (const r of c.rows) {
      snapshotAoA.push([r.metricLabel, round2(r.value), round2(r.diffPct)]);
    }
    snapshotAoA.push([]);
  }

  const sheetSnapshot = XLSX.utils.aoa_to_sheet(snapshotAoA);
  XLSX.utils.book_append_sheet(wb, sheetSnapshot, 'Snapshot');

  // Sheet 2: Raw (one row per metric leaf)
  const rawAoA: any[][] = [];
  rawAoA.push(['month', 'computedAt', 'category', 'metricKey', 'metricLabel', 'valueKind', 'value', 'diffKind', 'diffPct']);
  for (const r of rows) {
    rawAoA.push([
      r.month,
      r.computedAt,
      r.category,
      r.metricKey,
      r.metricLabel,
      r.valueKind,
      round2(r.value),
      r.diffKind,
      round2(r.diffPct),
    ]);
  }
  const sheetRaw = XLSX.utils.aoa_to_sheet(rawAoA);
  XLSX.utils.book_append_sheet(wb, sheetRaw, 'Raw');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const ab = out as ArrayBuffer;
  // Deterministic validation: read back the Raw sheet and compare to our expected table.
  validateRawSheet(ab, rawAoA);
  return ab;
}
