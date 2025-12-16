"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClickUpHttpClient_1 = require("../clickup/ClickUpHttpClient");
const computeDashboard_1 = require("../dashboard/computeDashboard");
const InstagramGraphClient_1 = require("../instagram/InstagramGraphClient");
function parseMonthArg() {
    const envMonth = process.env.F1_MONTH;
    if (envMonth)
        return envMonth;
    const arg = process.argv.find((a) => a.startsWith('--month='));
    if (!arg) {
        throw new Error('Missing required --month=YYYY-MM');
    }
    return arg.split('=')[1];
}
async function main() {
    const month = parseMonthArg();
    const clickupToken = process.env.CLICKUP_API_TOKEN;
    if (!clickupToken)
        throw new Error('Missing env var CLICKUP_API_TOKEN');
    const clickup = new ClickUpHttpClient_1.ClickUpHttpClient({ apiToken: clickupToken });
    const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId = process.env.INSTAGRAM_IG_USER_ID;
    const instagram = igToken && igUserId ? new InstagramGraphClient_1.InstagramGraphClient({ accessToken: igToken, igUserId }) : undefined;
    const result = await (0, computeDashboard_1.computeDashboard)(month, {
        clickup,
        instagram,
        computedAt: new Date(),
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
