import type { YYYYMM } from '../dashboard/types';

function parseYYYYMM(month: string): { year: number; monthIndex0: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new Error(`Invalid month format: "${month}". Expected YYYY-MM where MM is 01-12.`);
  }
  const year = Number(match[1]);
  const monthIndex0 = Number(match[2]) - 1;
  if (!Number.isInteger(year)) {
    throw new Error(`Invalid month value: "${month}" (bad year).`);
  }
  return { year, monthIndex0 };
}

function formatYYYYMM(year: number, monthIndex0: number): YYYYMM {
  const m = String(monthIndex0 + 1).padStart(2, '0');
  return `${year}-${m}` as YYYYMM;
}

export function addMonths(month: YYYYMM, delta: number): YYYYMM {
  const { year, monthIndex0 } = parseYYYYMM(month);
  const d = new Date(Date.UTC(year, monthIndex0 + delta, 1, 0, 0, 0, 0));
  return formatYYYYMM(d.getUTCFullYear(), d.getUTCMonth());
}

export function compareMonths(a: YYYYMM, b: YYYYMM): number {
  // YYYY-MM lexicographic compares correctly, but keep it explicit.
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function getTargetSnapshotMonth(now: Date): YYYYMM {
  const y = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  return formatYYYYMM(y, m0);
}

export function listMonthsInclusive(from: YYYYMM, to: YYYYMM): YYYYMM[] {
  if (compareMonths(from, to) > 0) return [];

  const months: YYYYMM[] = [];
  for (let cur = from; compareMonths(cur, to) <= 0; cur = addMonths(cur, 1)) {
    months.push(cur);
    if (months.length > 240) {
      throw new Error('Month range too large (safety limit).');
    }
  }
  return months;
}

/**
 * Returns months that should be generated to backfill from lastSnapshotMonth to targetMonth (inclusive).
 *
 * Rule:
 * - If lastSnapshotMonth is null => return [targetMonth]
 * - If lastSnapshotMonth >= targetMonth => []
 * - Else => (lastSnapshotMonth+1 ... targetMonth) inclusive
 */
export function listMissingSnapshotMonths(lastSnapshotMonth: YYYYMM | null, targetMonth: YYYYMM): YYYYMM[] {
  if (lastSnapshotMonth == null) return [targetMonth];
  if (compareMonths(lastSnapshotMonth, targetMonth) >= 0) return [];

  const start = addMonths(lastSnapshotMonth, 1);
  return listMonthsInclusive(start, targetMonth);
}
