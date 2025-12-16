"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const computeDashboard_1 = require("../dashboard/computeDashboard");
const mockDeps_1 = require("./mockDeps");
function parseMonthArg() {
    const envMonth = process.env.F1_MONTH;
    if (envMonth)
        return envMonth;
    const arg = process.argv.find((a) => a.startsWith('--month='));
    const month = (arg ? arg.split('=')[1] : '2025-12');
    return month;
}
async function main() {
    const month = parseMonthArg();
    const clickup = (0, mockDeps_1.createMockClickUpClient)();
    const instagram = (0, mockDeps_1.createMockInstagramClient)();
    const result = await (0, computeDashboard_1.computeDashboard)(month, {
        clickup,
        instagram,
        computedAt: (0, mockDeps_1.mockComputedAt)(),
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
