import type { DashboardMetrics, YYYYMM } from '../dashboard/types';
import { computeDiffFromPreviousPct } from './diff';
import type { SnapshotRecord } from './types';

export interface GenerateSnapshotRecordsInput {
  months: YYYYMM[];
  computeDashboard: (month: YYYYMM) => Promise<DashboardMetrics>;
  previousSnapshot?: { month: YYYYMM; metrics: DashboardMetrics };
  computedAt?: Date;
}

export async function generateSnapshotRecords(input: GenerateSnapshotRecordsInput): Promise<SnapshotRecord[]> {
  const computedAt = input.computedAt ?? new Date();

  // Ensure chronological order regardless of input ordering
  const months = [...input.months].sort();

  const out: SnapshotRecord[] = [];

  let prevMetrics: DashboardMetrics | null = input.previousSnapshot?.metrics ?? null;

  for (const month of months) {
    const metrics = await input.computeDashboard(month);

    const diffFromPreviousPct = prevMetrics
      ? computeDiffFromPreviousPct(metrics, prevMetrics)
      : computeDiffFromPreviousPct(metrics, metrics); // all null diffs (prev==current but prev values may be null/0)

    // The "no previous" case should be all null diffs; force it explicitly.
    const safeDiff = prevMetrics ? diffFromPreviousPct : nullDiffLike(diffFromPreviousPct);

    out.push({
      version: 'v1',
      month,
      metrics,
      diffFromPreviousPct: safeDiff,
      computedAt: computedAt.toISOString(),
    });

    prevMetrics = metrics;
  }

  return out;
}

function nullDiffLike(example: any): any {
  if (example == null) return null;
  if (Array.isArray(example)) return example.map(nullDiffLike);
  if (typeof example === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(example)) {
      out[k] = nullDiffLike(v);
    }
    return out;
  }
  // leaf number -> null
  return null;
}
