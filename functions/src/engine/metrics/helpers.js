"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meta = meta;
exports.currencyMetric = currencyMetric;
exports.countMetric = countMetric;
exports.percentMetric = percentMetric;
exports.ciEquals = ciEquals;
function meta(source, notes) {
    return { source, notes: notes && notes.length ? notes : undefined };
}
function currencyMetric(source, value, notes) {
    return {
        grossILS: value.grossILS,
        netILS: value.netILS,
        meta: meta(source, notes),
    };
}
function countMetric(source, value, notes) {
    return { value, meta: meta(source, notes) };
}
function percentMetric(source, value, notes) {
    return { value, meta: meta(source, notes) };
}
function ciEquals(a, b) {
    if (a == null)
        return false;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
