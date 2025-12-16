"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonthRange = getMonthRange;
exports.getPreviousMonth = getPreviousMonth;
exports.isWithinMonth = isWithinMonth;
function parseYYYYMM(month) {
    const match = /^([0-9]{4})-([0-9]{2})$/.exec(month);
    if (!match) {
        throw new Error(`Invalid month format: ${month}. Expected YYYY-MM.`);
    }
    const year = Number(match[1]);
    const monthIndex0 = Number(match[2]) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex0) || monthIndex0 < 0 || monthIndex0 > 11) {
        throw new Error(`Invalid month value: ${month}`);
    }
    return { year, monthIndex0 };
}
function getMonthRange(month) {
    const { year, monthIndex0 } = parseYYYYMM(month);
    const startMs = Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0);
    const endExclusiveMs = Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0, 0);
    return {
        month,
        start: new Date(startMs),
        endExclusive: new Date(endExclusiveMs),
        startMs,
        endExclusiveMs,
    };
}
function getPreviousMonth(month) {
    const { year, monthIndex0 } = parseYYYYMM(month);
    const prev = new Date(Date.UTC(year, monthIndex0 - 1, 1, 0, 0, 0, 0));
    const prevYear = prev.getUTCFullYear();
    const prevMonth = String(prev.getUTCMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
}
function isWithinMonth(timestampMs, range) {
    return timestampMs >= range.startMs && timestampMs < range.endExclusiveMs;
}
