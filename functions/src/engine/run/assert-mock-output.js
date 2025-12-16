"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const computeDashboard_1 = require("../dashboard/computeDashboard");
const mockDeps_1 = require("./mockDeps");
function parseMonth() {
    const envMonth = process.env.F1_MONTH;
    if (envMonth)
        return envMonth;
    const arg = process.argv.find((a) => a.startsWith('--month='));
    if (arg)
        return arg.split('=')[1];
    return '2025-12';
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
    const month = parseMonth();
    const update = process.argv.includes('--update');
    const clickup = (0, mockDeps_1.createMockClickUpClient)();
    const instagram = (0, mockDeps_1.createMockInstagramClient)();
    const actual = await (0, computeDashboard_1.computeDashboard)(month, {
        clickup,
        instagram,
        computedAt: (0, mockDeps_1.mockComputedAt)(),
    });
    const actualText = stableStringify(actual);
    const expectedPath = node_path_1.default.resolve(process.cwd(), 'backend', 'fixtures', `expected-dashboard-${month}.json`);
    if (update) {
        node_fs_1.default.writeFileSync(expectedPath, actualText, 'utf8');
        process.stdout.write(`Updated snapshot: ${expectedPath}\n`);
        return;
    }
    if (!node_fs_1.default.existsSync(expectedPath)) {
        throw new Error(`Missing expected snapshot for ${month}: ${expectedPath}. Run with --update to create it.`);
    }
    const expectedText = node_fs_1.default.readFileSync(expectedPath, 'utf8');
    if (expectedText === actualText) {
        process.stdout.write('OK: mock output matches expected snapshot.\n');
        return;
    }
    const idx = firstDiffIndex(expectedText, actualText);
    const contextStart = Math.max(0, idx - 120);
    const contextEnd = idx + 120;
    const expectedContext = expectedText.slice(contextStart, contextEnd);
    const actualContext = actualText.slice(contextStart, contextEnd);
    throw new Error(`Mock output differs from expected snapshot at index ${idx}.\n\n` +
        `Expected context:\n${expectedContext}\n\n` +
        `Actual context:\n${actualContext}\n\n` +
        `If this change is intentional, regenerate with: node dist-backend/run/assert-mock-output.js --update (or set F1_MONTH).\n`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
