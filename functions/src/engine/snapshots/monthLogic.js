"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMonths = addMonths;
exports.compareMonths = compareMonths;
exports.getTargetSnapshotMonth = getTargetSnapshotMonth;
exports.listMonthsInclusive = listMonthsInclusive;
exports.listMissingSnapshotMonths = listMissingSnapshotMonths;
function parseYYYYMM(month) {
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
function formatYYYYMM(year, monthIndex0) {
    const m = String(monthIndex0 + 1).padStart(2, '0');
    return `${year}-${m}`;
}
function addMonths(month, delta) {
    const { year, monthIndex0 } = parseYYYYMM(month);
    const d = new Date(Date.UTC(year, monthIndex0 + delta, 1, 0, 0, 0, 0));
    return formatYYYYMM(d.getUTCFullYear(), d.getUTCMonth());
}
function compareMonths(a, b) {
    // YYYY-MM lexicographic compares correctly, but keep it explicit.
    if (a === b)
        return 0;
    return a < b ? -1 : 1;
}
function getTargetSnapshotMonth(now) {
    const y = now.getUTCFullYear();
    const m0 = now.getUTCMonth();
    const prev = new Date(Date.UTC(y, m0 - 1, 1, 0, 0, 0, 0));
    return formatYYYYMM(prev.getUTCFullYear(), prev.getUTCMonth());
}
function listMonthsInclusive(from, to) {
    if (compareMonths(from, to) > 0)
        return [];
    const months = [];
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
function listMissingSnapshotMonths(lastSnapshotMonth, targetMonth) {
    if (lastSnapshotMonth == null)
        return [targetMonth];
    if (compareMonths(lastSnapshotMonth, targetMonth) >= 0)
        return [];
    const start = addMonths(lastSnapshotMonth, 1);
    return listMonthsInclusive(start, targetMonth);
}
