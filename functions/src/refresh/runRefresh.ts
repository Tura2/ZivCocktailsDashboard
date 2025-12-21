import { getDb } from './firebaseAdmin';
import { assertMonth } from './monthValidation';
import fs from 'node:fs';
import path from 'node:path';

// Engine imports (copied from repo-root dist/engine into functions/engine during build)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineMonthLogic = require('../../engine/snapshots/monthLogic');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineComputeDashboard = require('../../engine/dashboard/computeDashboard');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineClickUpHttp = require('../../engine/clickup/ClickUpHttpClient');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineInstagram = require('../../engine/instagram/InstagramGraphClient');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engineSnapshots = require('../../engine/snapshots/generateSnapshotRecords');

export interface RunRefreshInput {
  jobId: string;
  requestedByEmail: string;
  targetMonthInput?: unknown;
  log: (message: string) => Promise<void>;
}

export interface RunRefreshResult {
  targetMonth: string;
  writtenSnapshots: string[];
  skippedSnapshots: string[];
}

function isEmulatorMode(): boolean {
  if (process.env.FIREBASE_EMULATOR_HUB) return true;
  const raw = process.env.FUNCTIONS_EMULATOR;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return true;
}

function fixtureTasks(fileName: string): any[] {
  // In functions emulator, cwd is typically <repo>/functions.
  // Fixtures live at <repo>/backend/fixtures.
  const candidates = [
    path.resolve(process.cwd(), 'backend', 'fixtures', fileName),
    path.resolve(process.cwd(), '..', 'backend', 'fixtures', fileName),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const json = JSON.parse(raw) as { tasks?: unknown };
      const tasks = (json as any)?.tasks;
      return Array.isArray(tasks) ? tasks : [];
    } catch {
      // try next
    }
  }
  throw new Error(`Missing fixture file ${fileName}`);
}

class MockClickUpClient {
  private readonly tasksByListId: Record<string, any[]>;
  constructor(tasksByListId: Record<string, any[]>) {
    this.tasksByListId = tasksByListId;
  }
  async listTasks(options: { listId: string }): Promise<any[]> {
    return this.tasksByListId[options.listId] ?? [];
  }
}

class MockInstagramClient {
  async getFollowerCountSeries(): Promise<Array<{ endTimeIso: string; value: number }>> {
    return [
      { endTimeIso: '2025-11-30T23:59:59.000Z', value: 1000 },
      { endTimeIso: '2025-12-15T23:59:59.000Z', value: 1020 },
    ];
  }
}

function createMockClickUpClient(): any {
  return new MockClickUpClient({
    '901214362127': fixtureTasks('clickup-incoming-leads.json'),
    '901214362128': fixtureTasks('clickup-event-calendar.json'),
    '901214544874': fixtureTasks('clickup-expenses.json'),
  });
}

function createMockInstagramClient(): any {
  return new MockInstagramClient();
}

function mockComputedAt(): Date {
  return new Date('2025-12-16T12:00:00.000Z');
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function getLastSnapshotMonth(): Promise<string | null> {
  const snap = await getDb().collection('snapshots').orderBy('month', 'desc').limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const month = doc.get('month');
  return typeof month === 'string' ? month : null;
}

async function tryReadSnapshotMetrics(month: string): Promise<any | null> {
  const doc = await getDb().collection('snapshots').doc(month).get();
  if (!doc.exists) return null;
  return doc.get('metrics') ?? null;
}

function isAlreadyExistsError(e: unknown): boolean {
  const anyErr = e as any;
  // Firestore gRPC status code for ALREADY_EXISTS is 6.
  return anyErr?.code === 6 || String(anyErr?.message ?? '').includes('ALREADY_EXISTS');
}

export async function runRefresh(input: RunRefreshInput): Promise<RunRefreshResult> {
  const emulatorMode = isEmulatorMode();

  const now: Date = emulatorMode ? mockComputedAt() : new Date();

  const targetMonth = input.targetMonthInput
    ? assertMonth(input.targetMonthInput, 'targetMonth')
    : engineMonthLogic.getTargetSnapshotMonth(now);

  await input.log(`Resolved targetMonth=${targetMonth}`);

  // ClickUp + Instagram deps for compute engine
  const clickup = emulatorMode
    ? createMockClickUpClient()
    : new engineClickUpHttp.ClickUpHttpClient({ apiToken: env('CLICKUP_API_TOKEN') });

  const instagram = emulatorMode
    ? createMockInstagramClient()
    : (() => {
        const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
        const igUserId = process.env.INSTAGRAM_IG_USER_ID;
        return igToken && igUserId ? new engineInstagram.InstagramGraphClient({ accessToken: igToken, igUserId }) : undefined;
      })();

  const lastSnapshotMonth = await getLastSnapshotMonth();
  await input.log(`Last snapshot month in Firestore: ${lastSnapshotMonth ?? '(none)'}`);

  const missingMonths: string[] = engineMonthLogic.listMissingSnapshotMonths(lastSnapshotMonth, targetMonth);
  await input.log(`Missing months to generate: ${missingMonths.join(', ') || '(none)'}`);

  // Optional previous snapshot metrics to seed diffs
  const previousSnapshotMetrics = lastSnapshotMonth ? await tryReadSnapshotMetrics(lastSnapshotMonth) : null;

  const records = await engineSnapshots.generateSnapshotRecords({
    months: missingMonths,
    computedAt: now,
    previousSnapshot: previousSnapshotMetrics ? { month: lastSnapshotMonth, metrics: previousSnapshotMetrics } : undefined,
    computeDashboard: (month: string) => engineComputeDashboard.computeDashboard(month, { clickup, instagram, computedAt: now }),
  });

  const writtenSnapshots: string[] = [];
  const skippedSnapshots: string[] = [];

  for (const rec of records) {
    const month = rec.month as string;
    const ref = getDb().collection('snapshots').doc(month);

    try {
      await ref.create({
        version: 'v1',
        month,
        computedAt: rec.computedAt,
        metrics: rec.metrics,
        diffFromPreviousPct: rec.diffFromPreviousPct,
      });

      writtenSnapshots.push(month);
      await input.log(`Wrote snapshots/${month}`);
    } catch (e) {
      if (isAlreadyExistsError(e)) {
        skippedSnapshots.push(month);
        await input.log(`Skip snapshots/${month} (already exists)`);
        continue;
      }
      throw e;
    }
  }

  // Explicitly ensure targetMonth is reported as skipped if it already exists.
  // This supports idempotent re-runs where missingMonths=[] (lastSnapshotMonth >= targetMonth).
  if (!missingMonths.includes(targetMonth)) {
    const ref = getDb().collection('snapshots').doc(targetMonth);
    const existing = await ref.get();
    if (existing.exists) {
      skippedSnapshots.push(targetMonth);
      await input.log(`Skip snapshots/${targetMonth} (already exists)`);
    } else {
      // Create a single snapshot record for targetMonth.
      const prevMonth = engineMonthLogic.addMonths(targetMonth, -1);
      const prevMetrics = await tryReadSnapshotMetrics(prevMonth);

      const [rec] = await engineSnapshots.generateSnapshotRecords({
        months: [targetMonth],
        computedAt: now,
        previousSnapshot: prevMetrics ? { month: prevMonth, metrics: prevMetrics } : undefined,
        computeDashboard: (month: string) => engineComputeDashboard.computeDashboard(month, { clickup, instagram, computedAt: now }),
      });

      try {
        await ref.create({
          version: 'v1',
          month: targetMonth,
          computedAt: rec.computedAt,
          metrics: rec.metrics,
          diffFromPreviousPct: rec.diffFromPreviousPct,
        });
        writtenSnapshots.push(targetMonth);
        await input.log(`Wrote snapshots/${targetMonth}`);
      } catch (e) {
        if (isAlreadyExistsError(e)) {
          skippedSnapshots.push(targetMonth);
          await input.log(`Skip snapshots/${targetMonth} (already exists)`);
        } else {
          throw e;
        }
      }
    }
  }

  // dashboard/latest always overwritten with targetMonth metrics
  const dashboardMetrics = await engineComputeDashboard.computeDashboard(targetMonth, { clickup, instagram, computedAt: now });

  await getDb().collection('dashboard').doc('latest').set(
    {
      version: 'v1',
      month: targetMonth,
      computedAt: dashboardMetrics.computedAt,
      metrics: dashboardMetrics,
    },
    { merge: false },
  );

  await input.log(`Wrote dashboard/latest for ${targetMonth}`);

  // Update job doc targetMonth
  await getDb().collection('jobs').doc(input.jobId).update({ targetMonth });

  return { targetMonth, writtenSnapshots, skippedSnapshots };
}
