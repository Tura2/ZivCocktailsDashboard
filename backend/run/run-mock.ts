import { computeDashboard } from '../dashboard/computeDashboard';
import type { YYYYMM } from '../dashboard/types';
import { createMockClickUpClient, createMockInstagramClient, mockComputedAt } from './mockDeps';

function parseMonthArg(): YYYYMM {
  const envMonth = process.env.F1_MONTH;
  if (envMonth) return envMonth as YYYYMM;
  const arg = process.argv.find((a) => a.startsWith('--month='));
  const month = (arg ? arg.split('=')[1] : '2025-12') as YYYYMM;
  return month;
}

async function main(): Promise<void> {
  const month = parseMonthArg();

  const clickup = createMockClickUpClient();
  const instagram = createMockInstagramClient();

  const result = await computeDashboard(month, {
    clickup,
    instagram,
    computedAt: mockComputedAt(),
  });

  process.stdout.write(JSON.stringify(result, null, 2));
  process.stdout.write('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
