"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
async function main() {
    const months = parseMonths();
    const clickup = (0, mockDeps_1.createMockClickUpClient)();
    const instagram = (0, mockDeps_1.createMockInstagramClient)();
    const computedAt = (0, mockDeps_1.mockComputedAt)();
    const records = await (0, generateSnapshotRecords_1.generateSnapshotRecords)({
        months,
        computedAt,
        computeDashboard: (month) => (0, computeDashboard_1.computeDashboard)(month, { clickup, instagram, computedAt }),
    });
    process.stdout.write(JSON.stringify(records, null, 2));
    process.stdout.write('\n');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
