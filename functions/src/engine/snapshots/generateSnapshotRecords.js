"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSnapshotRecords = generateSnapshotRecords;
const diff_1 = require("./diff");
async function generateSnapshotRecords(input) {
    const computedAt = input.computedAt ?? new Date();
    // Ensure chronological order regardless of input ordering
    const months = [...input.months].sort();
    const out = [];
    let prevMetrics = input.previousSnapshot?.metrics ?? null;
    for (const month of months) {
        const metrics = await input.computeDashboard(month);
        const diffFromPreviousPct = prevMetrics
            ? (0, diff_1.computeDiffFromPreviousPct)(metrics, prevMetrics)
            : (0, diff_1.computeDiffFromPreviousPct)(metrics, metrics); // all null diffs (prev==current but prev values may be null/0)
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
function nullDiffLike(example) {
    if (example == null)
        return null;
    if (Array.isArray(example))
        return example.map(nullDiffLike);
    if (typeof example === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(example)) {
            out[k] = nullDiffLike(v);
        }
        return out;
    }
    // leaf number -> null
    return null;
}
