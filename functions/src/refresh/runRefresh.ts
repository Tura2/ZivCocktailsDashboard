import { getDb } from './firebaseAdmin';
import { assertMonth } from './monthValidation';
import fs from 'node:fs';
import path from 'node:path';
import { CLICKUP_API_TOKEN, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_IG_USER_ID } from '../config/secrets';

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
const engineDiff = require('../../engine/snapshots/diff');

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

  async getTaskComments(): Promise<any[]> {
    return [];
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

function nullDiffLike(example: any): any {
  if (example == null) return null;
  if (Array.isArray(example)) return example.map(nullDiffLike);
  if (typeof example === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(example)) {
      out[k] = nullDiffLike(v);
    }
    return out;
  }
  return null;
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
    : new engineClickUpHttp.ClickUpHttpClient({ apiToken: CLICKUP_API_TOKEN.value() });

  const instagram = emulatorMode
    ? createMockInstagramClient()
    : (() => {
        const igToken = INSTAGRAM_ACCESS_TOKEN.value();
        const igUserId = INSTAGRAM_IG_USER_ID.value();
        return igToken && igUserId ? new engineInstagram.InstagramGraphClient({ accessToken: igToken, igUserId }) : undefined;
      })();

  const lastSnapshotMonth = await getLastSnapshotMonth();
  await input.log(`Last snapshot month in Firestore: ${lastSnapshotMonth ?? '(none)'}`);

  const missingMonths: string[] = engineMonthLogic.listMissingSnapshotMonths(lastSnapshotMonth, targetMonth);
  await input.log(`Missing months to generate: ${missingMonths.join(', ') || '(none)'}`);

  const writtenSnapshots: string[] = [];
  const skippedSnapshots: string[] = [];

  // Seed diff chain from the last stored snapshot (if any).
  let prevMetrics: any | null = lastSnapshotMonth ? await tryReadSnapshotMetrics(lastSnapshotMonth) : null;

  // Create missing snapshots in chronological order, including breakdown docs.
  for (const month of [...missingMonths].sort()) {
    const ref = getDb().collection('snapshots').doc(month);

    // Compute metrics + breakdowns once.
    const artifacts = await engineComputeDashboard.computeDashboardWithBreakdowns(month, { clickup, instagram, computedAt: now });
    const metrics = artifacts.metrics;

    const diffFromPreviousPct = prevMetrics
      ? engineDiff.computeDiffFromPreviousPct(metrics, prevMetrics)
      : nullDiffLike(engineDiff.computeDiffFromPreviousPct(metrics, metrics));

    const batch = getDb().batch();
    batch.create(ref, {
      version: 'v1',
      month,
      computedAt: metrics.computedAt,
      metrics,
      diffFromPreviousPct,
    });

    const breakdownParent = ref.collection('metricBreakdowns');
    const breakdowns = (artifacts.breakdowns ?? {}) as Record<string, any>;
    for (const breakdown of Object.values(breakdowns) as any[]) {
      if (!breakdown || breakdown.kind === 'none') continue;
      batch.set(breakdownParent.doc(String(breakdown.metricKey)), breakdown, { merge: false });
    }

    try {
      await batch.commit();
      writtenSnapshots.push(month);
      await input.log(`Wrote snapshots/${month} (+ metricBreakdowns)`);
      prevMetrics = metrics;
    } catch (e) {
      if (isAlreadyExistsError(e)) {
        skippedSnapshots.push(month);
        await input.log(`Skip snapshots/${month} (already exists)`);
        // Keep prevMetrics unchanged so diff chain remains correct for subsequent creates.
        continue;
      }
      throw e;
    }
  }

  // Always overwrite snapshots/targetMonth so History reflects the latest refreshed metrics.
  // (Using create() makes snapshots immutable and causes History to drift from dashboard/latest.)
  {
    const ref = getDb().collection('snapshots').doc(targetMonth);
    const prevMonth = engineMonthLogic.addMonths(targetMonth, -1);
    const prevMetrics = await tryReadSnapshotMetrics(prevMonth);

    // Compute metrics + breakdowns once, then batch-write snapshot + breakdown docs + dashboard/latest.
    const artifacts = await engineComputeDashboard.computeDashboardWithBreakdowns(targetMonth, { clickup, instagram, computedAt: now });
    const metrics = artifacts.metrics;

    const diffFromPreviousPct = prevMetrics
      ? engineDiff.computeDiffFromPreviousPct(metrics, prevMetrics)
      : nullDiffLike(engineDiff.computeDiffFromPreviousPct(metrics, metrics));

    const batch = getDb().batch();

    batch.set(
      ref,
      {
        version: 'v1',
        month: targetMonth,
        computedAt: metrics.computedAt,
        metrics,
        diffFromPreviousPct,
      },
      { merge: false },
    );

    // Persist breakdown docs under snapshots/{month}/metricBreakdowns/{metricKey}
    const breakdownParent = ref.collection('metricBreakdowns');
    const knownKeys = [
      'totalLeads',
      'relevantLeads',
      'landingVisits',
      'landingSignups',
      'monthlyRevenue',
      'monthlyRevenueNet',
      'expectedCashflow',
      'expectedExpenses',
      'activeCustomers',
      'cancellations',
      'referralsWordOfMouth',
      'returningCustomers',
      'closures',
      'avgRevenuePerDealGross',
      // Explicitly ensure as-is metrics do not have breakdown docs.
      'followersEndOfMonth',
      'followersDeltaMonth',
    ];

    const present = new Set(Object.keys(artifacts.breakdowns ?? {}));

    for (const key of knownKeys) {
      const docRef = breakdownParent.doc(key);
      const breakdown = artifacts.breakdowns?.[key];

      if (!breakdown || breakdown.kind === 'none') {
        // Delete stale docs if any.
        batch.delete(docRef);
        continue;
      }

      batch.set(docRef, breakdown, { merge: false });
    }

    // dashboard/latest always overwritten with targetMonth metrics
    batch.set(
      getDb().collection('dashboard').doc('latest'),
      {
        version: 'v1',
        month: targetMonth,
        computedAt: metrics.computedAt,
        metrics,
      },
      { merge: false },
    );

    await batch.commit();

    if (!writtenSnapshots.includes(targetMonth)) {
      writtenSnapshots.push(targetMonth);
    }
    await input.log(`Upsert snapshots/${targetMonth}`);
  }

  await input.log(`Wrote dashboard/latest + metricBreakdowns for ${targetMonth}`);

  // Update job doc targetMonth
  await getDb().collection('jobs').doc(input.jobId).update({ targetMonth });

  return { targetMonth, writtenSnapshots, skippedSnapshots };
}
