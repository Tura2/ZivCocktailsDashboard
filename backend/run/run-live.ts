import { ClickUpHttpClient } from '../clickup/ClickUpHttpClient';
import { computeDashboard } from '../dashboard/computeDashboard';
import { InstagramGraphClient } from '../instagram/InstagramGraphClient';
import type { YYYYMM } from '../dashboard/types';

function parseMonthArg(): YYYYMM {
  const envMonth = process.env.F1_MONTH;
  if (envMonth) return envMonth as YYYYMM;
  const arg = process.argv.find((a) => a.startsWith('--month='));
  if (!arg) {
    throw new Error('Missing required --month=YYYY-MM');
  }
  return arg.split('=')[1] as YYYYMM;
}

async function main(): Promise<void> {
  const month = parseMonthArg();

  const clickupToken = process.env.CLICKUP_API_TOKEN;
  if (!clickupToken) throw new Error('Missing env var CLICKUP_API_TOKEN');

  const clickup = new ClickUpHttpClient({ apiToken: clickupToken });

  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_IG_USER_ID;
  const instagram = igToken && igUserId ? new InstagramGraphClient({ accessToken: igToken, igUserId }) : undefined;

  const result = await computeDashboard(month, {
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
