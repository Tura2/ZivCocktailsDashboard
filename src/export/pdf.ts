import type { SnapshotRecord } from '@/lib/snapshots/types';
import { jsPDF } from 'jspdf';
import { assertExportRowsMatchSnapshot, snapshotToExportRows, type SnapshotExportRow } from '@/export/rows';

function displayValue(row: SnapshotExportRow): string {
  if (row.value == null) return '—';
  const v = Number.isFinite(row.value) ? row.value.toFixed(2) : String(row.value);
  if (row.valueKind === 'currency_gross' || row.valueKind === 'currency_net') return `₪ ${v}`;
  if (row.valueKind === 'percent') return `${v}%`;
  return v;
}

function displayDiff(row: SnapshotExportRow): string {
  if (row.diffPct == null) return '—';
  const v = Number.isFinite(row.diffPct) ? row.diffPct.toFixed(2) : String(row.diffPct);
  return `${v}%`;
}

export function exportSnapshotToPdf(snapshot: SnapshotRecord): Uint8Array {
  const rows = snapshotToExportRows(snapshot);
  assertExportRowsMatchSnapshot(snapshot, rows);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 40;
  let y = 44;

  const title = 'Ziv Cocktails — Monthly Snapshot';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, marginX, y);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Month: ${snapshot.month}`, marginX, y);
  y += 14;
  doc.text(`Computed at: ${snapshot.computedAt}`, marginX, y);
  y += 18;

  const categories: Array<{ name: string; rows: SnapshotExportRow[] }> = [
    { name: 'Financial', rows: rows.filter((r) => r.category === 'Financial') },
    { name: 'Marketing', rows: rows.filter((r) => r.category === 'Marketing') },
    { name: 'Sales', rows: rows.filter((r) => r.category === 'Sales') },
    { name: 'Operations', rows: rows.filter((r) => r.category === 'Operations') },
  ];

  const colMetric = marginX;
  const colValue = Math.floor(pageWidth * 0.64);
  const colDiff = Math.floor(pageWidth * 0.82);

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 40) return;
    doc.addPage();
    y = 44;
  };

  for (const c of categories) {
    ensureSpace(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(c.name, marginX, y);
    y += 12;

    doc.setFontSize(10);
    doc.text('Metric', colMetric, y);
    doc.text('Value', colValue, y);
    doc.text('MoM diff', colDiff, y);
    y += 8;

    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;

    doc.setFont('helvetica', 'normal');

    for (const r of c.rows) {
      ensureSpace(18);

      const metric = r.metricLabel;
      const value = displayValue(r);
      const diff = displayDiff(r);

      doc.text(metric, colMetric, y, { maxWidth: colValue - colMetric - 10 });
      doc.text(value, colValue, y);
      doc.text(diff, colDiff, y);
      y += 14;
    }

    y += 10;
  }

  const ab = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(ab);
}
