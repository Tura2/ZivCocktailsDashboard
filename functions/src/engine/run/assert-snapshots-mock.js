"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const computeDashboard_1 = require("../dashboard/computeDashboard");
const generateSnapshotRecords_1 = require("../snapshots/generateSnapshotRecords");
const mockDeps_1 = require("./mockDeps");
function parseMonths() {
    const envMonths = process.env.F2_MONTHS;
    if (envMonths) {
        return envMonths.split(',').map((m) => m.trim()).filter(Boolean);
    }
    const arg = process.argv.find((a) => a.startsWith('--months='));
    if (arg) {
        const list = arg.split('=')[1];
        return list.split(',').map((m) => m.trim()).filter(Boolean);
    }
    return ['2025-10', '2025-11', '2025-12'];
}
function snapshotFileName(months) {
    const first = months[0];
    const last = months[months.length - 1];
    return `expected-snapshots-${first}_to_${last}.json`;
}
function stableStringify(value, indent = 2) {
    function normalize(v) {
        if (v === null)
            return null;
        if (Array.isArray(v))
            return v.map(normalize);
        if (typeof v === 'object') {
            const obj = v;
            const out = {};
            for (const key of Object.keys(obj).sort()) {
                out[key] = normalize(obj[key]);
            }
            return out;
        }
        return v;
    }
    return JSON.stringify(normalize(value), null, indent) + '\n';
}
function firstDiffIndex(a, b) {
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i += 1) {
        if (a[i] !== b[i])
            return i;
    }
    return a.length === b.length ? -1 : min;
}
async function main() {
    const months = parseMonths().slice().sort();
    const update = process.argv.includes('--update');
    const clickup = (0, mockDeps_1.createMockClickUpClient)();
    const instagram = (0, mockDeps_1.createMockInstagramClient)();
    const computedAt = (0, mockDeps_1.mockComputedAt)();
    const records = await (0, generateSnapshotRecords_1.generateSnapshotRecords)({
        months,
        computedAt,
        computeDashboard: (month) => (0, computeDashboard_1.computeDashboard)(month, { clickup, instagram, computedAt }),
    });
    const actualText = stableStringify(records);
    const expectedPath = node_path_1.default.resolve(process.cwd(), 'backend', 'fixtures', snapshotFileName(months));
    if (update) {
        node_fs_1.default.writeFileSync(expectedPath, actualText, 'utf8');
        process.stdout.write(`Updated snapshot: ${expectedPath}\n`);
        return;
    }
    if (!node_fs_1.default.existsSync(expectedPath)) {
        throw new Error(`Missing expected snapshot: ${expectedPath}. Run with --update to create it.`);
    }
    const expectedText = node_fs_1.default.readFileSync(expectedPath, 'utf8');
    if (expectedText === actualText) {
        process.stdout.write('OK: snapshot output matches expected.\n');
        return;
    }
    const idx = firstDiffIndex(expectedText, actualText);
    const contextStart = Math.max(0, idx - 120);
    const contextEnd = idx + 120;
    throw new Error(`Snapshot output differs from expected at index ${idx}.\n\n` +
        `Expected context:\n${expectedText.slice(contextStart, contextEnd)}\n\n` +
        `Actual context:\n${actualText.slice(contextStart, contextEnd)}\n\n` +
        `If intentional, regenerate with: node dist/engine/run/assert-snapshots-mock.js --update\n`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
