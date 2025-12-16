import { computeDashboard } from '../dashboard/computeDashboard';
import type { YYYYMM } from '../dashboard/types';
import { generateSnapshotRecords } from '../snapshots/generateSnapshotRecords';
import { createMockClickUpClient, createMockInstagramClient, mockComputedAt } from './mockDeps';

function parseMonths(): YYYYMM[] {
  const envMonths = process.env.F2_MONTHS;
  if (envMonths) {
    return envMonths.split(',').map((m) => m.trim() as YYYYMM).filter(Boolean);
  }

  const arg = process.argv.find((a) => a.startsWith('--months='));
  if (arg) {
    const list = arg.split('=')[1];
    return list.split(',').map((m) => m.trim() as YYYYMM).filter(Boolean);
  }

  return ['2025-10', '2025-11', '2025-12'] as YYYYMM[];
}

async function main(): Promise<void> {
  const months = parseMonths();
  const clickup = createMockClickUpClient();
  const instagram = createMockInstagramClient();
  const computedAt = mockComputedAt();

  const records = await generateSnapshotRecords({
    months,
    computedAt,
    computeDashboard: (month) => computeDashboard(month, { clickup, instagram, computedAt }),
  });

  process.stdout.write(JSON.stringify(records, null, 2));
  process.stdout.write('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
