import type { SnapshotRecord } from '@/lib/snapshots/types';
import { assertExportRowsMatchSnapshot, snapshotToExportRows } from '@/export/rows';

function csvEscape(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return v.toFixed(2);
  }
  return String(v);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cur += ch;
      continue;
    }

    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function validateCsv(snapshot: SnapshotRecord, csv: string) {
  const expectedRows = snapshotToExportRows(snapshot);

  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0] ?? '';
  const headerCols = parseCsvLine(header);
  const expectedHeader = ['month', 'computedAt', 'category', 'metricKey', 'metricLabel', 'valueKind', 'value', 'diffKind', 'diffPct'];
  if (headerCols.join('|') !== expectedHeader.join('|')) {
    throw new Error('CSV validation failed: unexpected header');
  }

  const dataLines = lines.slice(1);
  if (dataLines.length !== expectedRows.length) {
    throw new Error(`CSV validation failed: row count mismatch (${dataLines.length} vs ${expectedRows.length})`);
  }

  for (let i = 0; i < expectedRows.length; i++) {
    const cols = parseCsvLine(dataLines[i]);
    if (cols.length !== expectedHeader.length) {
      throw new Error(`CSV validation failed: row ${i} column count mismatch (${cols.length})`);
    }
    const exp = expectedRows[i];
    const expValue = formatCell(exp.value);
    const expDiff = formatCell(exp.diffPct);

    if (cols[0] !== exp.month) throw new Error(`CSV validation failed: row ${i} month mismatch`);
    if (cols[1] !== exp.computedAt) throw new Error(`CSV validation failed: row ${i} computedAt mismatch`);
    if (cols[2] !== exp.category) throw new Error(`CSV validation failed: row ${i} category mismatch`);
    if (cols[3] !== exp.metricKey) throw new Error(`CSV validation failed: row ${i} metricKey mismatch`);
    if (cols[5] !== exp.valueKind) throw new Error(`CSV validation failed: row ${i} valueKind mismatch`);
    if (cols[6] !== expValue) throw new Error(`CSV validation failed: row ${i} value mismatch for ${exp.metricKey}`);
    if (cols[7] !== exp.diffKind) throw new Error(`CSV validation failed: row ${i} diffKind mismatch`);
    if (cols[8] !== expDiff) throw new Error(`CSV validation failed: row ${i} diff mismatch for ${exp.metricKey}`);
  }
}

export function exportSnapshotToCsv(snapshot: SnapshotRecord): string {
  const rows = snapshotToExportRows(snapshot);
  assertExportRowsMatchSnapshot(snapshot, rows);

  const header = ['month', 'computedAt', 'category', 'metricKey', 'metricLabel', 'valueKind', 'value', 'diffKind', 'diffPct'];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(','));

  for (const r of rows) {
    const line = [
      r.month,
      r.computedAt,
      r.category,
      r.metricKey,
      r.metricLabel,
      r.valueKind,
      formatCell(r.value),
      r.diffKind,
      formatCell(r.diffPct),
    ];
    lines.push(line.map((c) => csvEscape(String(c ?? ''))).join(','));
  }

  const csv = lines.join('\n') + '\n';
  // Deterministic validation: parse output and compare back to snapshot-derived rows.
  validateCsv(snapshot, csv);
  return csv;
}
