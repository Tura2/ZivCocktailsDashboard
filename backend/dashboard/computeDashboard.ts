import type { DashboardMetrics, YYYYMM } from './types';
import type { ClickUpClient } from '../clickup/ClickUpClient';
import { fetchEventCalendar, fetchExpenses, fetchIncomingLeads } from '../clickup/fetchLists';
import { getMonthRange, getPreviousMonth } from '../time/month';
import { normalizeEvent, normalizeExpense, normalizeIncomingLead } from '../normalize/clickup';
import { computeFinancialMetrics } from '../metrics/financial';
import { computeMarketingMetrics } from '../metrics/marketing';
import { computeSalesMetrics } from '../metrics/sales';
import { computeOperationsMetrics } from '../metrics/operations';
import type { InstagramClient } from '../instagram/InstagramClient';
import { ciEquals, countMetric, currencyMetric } from '../metrics/helpers';
import {
  extractDepositPaidTimestampMs,
  extractFirstBillingToDoneTransitionTimestampMs,
  extractFirstDoneStatusChangeTimestampMs,
  getClosedWonMoveTimestampMs,
} from '../clickup/comments';
import { CLICKUP } from '../config/dataContract';
import { ensureNetGross } from '../vat/vat';
import { isWithinMonth } from '../time/month';
import type { ClickUpCustomField, ClickUpTask, ClickUpTaskComment } from '../clickup/types';

export interface ComputeDashboardDeps {
  clickup: ClickUpClient;
  instagram?: InstagramClient;
  computedAt?: Date;
}

function monthFromDateUTC(d: Date): YYYYMM {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}` as YYYYMM;
}

function pickLastInMonth(series: Array<{ endTimeIso: string; value: number }>, range: { startMs: number; endExclusiveMs: number }): number | null {
  let last: { ms: number; value: number } | null = null;

  for (const sample of series) {
    const ms = Date.parse(sample.endTimeIso);
    if (!Number.isFinite(ms)) continue;
    if (ms < range.startMs || ms >= range.endExclusiveMs) continue;
    if (!last || ms > last.ms) last = { ms, value: sample.value };
  }

  return last ? last.value : null;
}

function parseTaskMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseNumberLoose(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9+\-.,]/g, '').replace(/,/g, '');
    const asNum = Number(cleaned);
    return Number.isFinite(asNum) ? asNum : null;
  }
  if (typeof v === 'object') {
    const anyV = v as any;
    if (anyV && typeof anyV.value !== 'undefined') return parseNumberLoose(anyV.value);
  }
  const asNum = Number(v as any);
  return Number.isFinite(asNum) ? asNum : null;
}

function findCustomField(task: ClickUpTask, predicate: (f: ClickUpCustomField) => boolean): ClickUpCustomField | undefined {
  return task.custom_fields?.find(predicate);
}

function readNumberCustomField(task: ClickUpTask, options: { id?: string; nameMatchers: RegExp[] }): number | null {
  const field = findCustomField(task, (f) => {
    if (options.id && f.id === options.id) return true;
    const name = f.name ?? '';
    return options.nameMatchers.some((re) => re.test(name));
  });

  return parseNumberLoose(field?.value);
}

function isDoneStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  // Most ClickUp workspaces use one of these labels for a completed/closed task.
  return ciEquals(status, 'done') || ciEquals(status, 'complete') || ciEquals(status, 'completed');
}

async function computeMonthlyRevenueFromEventCalendar(args: {
  range: ReturnType<typeof getMonthRange>;
  getComments: (taskId: string) => Promise<ClickUpTaskComment[]>;
  eventTasks: ClickUpTask[];
}): Promise<{ gross: number; net: number; notes: string[] }> {
  const notes: string[] = [];

  // Field selection:
  // - Deposit: prefer explicit id if it matches the existing Paid Amount field, else name match.
  // - Balance Due: name match only (field id not present in repo data contract).
  const depositNameMatchers = [/deposit/i, /advance/i, /מקדמה/];
  const balanceNameMatchers = [/balance/i, /due/i, /יתרה/, /השלמה/];

  let depositsGross = 0;
  let balancesGross = 0;
  let depositCount = 0;
  let balanceCount = 0;

  // Bound comment lookups to keep refresh predictable.
  const maxCommentLookups = 200;
  let commentLookups = 0;

  for (const task of args.eventTasks) {
    const status = task.status?.status ?? null;

    let comments: ClickUpTaskComment[] | null = null;
    const getTaskComments = async () => {
      if (comments) return comments;
      if (commentLookups >= maxCommentLookups) return [];
      commentLookups += 1;
      comments = await args.getComments(task.id);
      return comments;
    };

    // DONE attribution: prefer ClickBot automation comment timestamp (first time it hit DONE)
    // to handle status reversion (DONE -> other -> DONE) without double counting.
    let doneMs: number | null = null;
    try {
      doneMs = extractFirstDoneStatusChangeTimestampMs(await getTaskComments());
    } catch (e) {
      notes.push(`DONE status comment fetch failed for task ${task.id}: ${(e as Error).message}`);
    }

    if (doneMs == null) {
      doneMs = parseTaskMs(task.date_closed ?? undefined) ?? (isDoneStatus(status) ? parseTaskMs(task.date_updated) : null);
    }
    const balanceDue = readNumberCustomField(task, { nameMatchers: balanceNameMatchers });

    if (doneMs != null && isWithinMonth(doneMs, args.range)) {
      if (balanceDue == null) {
        notes.push(`Balance Due missing for DONE task ${task.id} => treated as 0`);
      } else {
        balancesGross += balanceDue;
      }
      balanceCount += 1;
    }

    // Deposit recognition uses comment timestamp; only attempt when we have a plausible deposit field
    // or the task was touched in the month (so we can still surface missing-field errors).
    const depositValue = readNumberCustomField(task, { id: CLICKUP.fields.paidAmount, nameMatchers: depositNameMatchers });
    const updatedMs = parseTaskMs(task.date_updated);
    const shouldCheckDepositComments =
      (depositValue != null && depositValue !== 0) || (updatedMs != null && isWithinMonth(updatedMs, args.range));

    if (!shouldCheckDepositComments) continue;
    if (commentLookups >= maxCommentLookups) {
      notes.push(`Deposit comment lookups capped at ${maxCommentLookups}; results may be incomplete`);
      break;
    }

    let depositPaidMs: number | null = null;
    try {
      depositPaidMs = extractDepositPaidTimestampMs(await getTaskComments());
    } catch (e) {
      notes.push(`Deposit comment fetch failed for task ${task.id}: ${(e as Error).message}`);
      continue;
    }

    if (depositPaidMs == null) continue;
    if (!isWithinMonth(depositPaidMs, args.range)) continue;

    if (depositValue == null) {
      notes.push(`Deposit comment found but Deposit field missing for task ${task.id} => treated as 0`);
    } else {
      depositsGross += depositValue;
    }
    depositCount += 1;
  }

  notes.push(`Monthly revenue from Event Calendar: deposits=${depositsGross} (${depositCount} tasks), balances=${balancesGross} (${balanceCount} tasks)`);
  notes.push('DONE attribution uses first ClickBot "Status has changed to : DONE" comment timestamp (fallback: task.date_closed)');
  notes.push('Budget treated as gross ILS; net computed with VAT 18%');

  const totals = ensureNetGross({ grossILS: depositsGross + balancesGross, netILS: null });
  return { gross: totals.grossILS ?? 0, net: totals.netILS ?? 0, notes };
}

async function computeExpectedRevenueV2FromEventCalendar(args: {
  range: ReturnType<typeof getMonthRange>;
  getComments: (taskId: string) => Promise<ClickUpTaskComment[]>;
  eventTasks: ClickUpTask[];
}): Promise<{ gross: number; net: number; notes: string[] }> {
  const notes: string[] = [];

  const depositNameMatchers = [/deposit/i, /advance/i, /מקדמה/];
  const balanceNameMatchers = [/balance/i, /due/i, /יתרה/, /השלמה/];

  let depositsGross = 0;
  let scheduledBalancesGross = 0;
  let billingReleaseGross = 0;
  let depositCount = 0;
  let scheduledCount = 0;
  let billingReleaseCount = 0;

  // Bound comment lookups to keep refresh predictable.
  const maxCommentLookups = 250;
  let commentLookups = 0;

  for (const task of args.eventTasks) {
    const status = task.status?.status ?? null;
    const eventDateMs = parseNumberLoose(findCustomField(task, (f) => f.id === CLICKUP.fields.requestedDate)?.value);

    const depositValue = readNumberCustomField(task, { id: CLICKUP.fields.paidAmount, nameMatchers: depositNameMatchers });
    const balanceDue = readNumberCustomField(task, { nameMatchers: balanceNameMatchers });

    // Fetch comments once if we need any timestamp-based logic.
    let comments: ClickUpTaskComment[] | null = null;
    const getTaskComments = async () => {
      if (comments) return comments;
      if (commentLookups >= maxCommentLookups) return [];
      commentLookups += 1;
      comments = await args.getComments(task.id);
      return comments;
    };

    // C) Billing Release: Billing -> Done transition in month
    let billingToDoneMs: number | null = null;
    try {
      billingToDoneMs = extractFirstBillingToDoneTransitionTimestampMs(await getTaskComments());
    } catch (e) {
      notes.push(`Status history comment parse failed for task ${task.id}: ${(e as Error).message}`);
      billingToDoneMs = null;
    }

    if (billingToDoneMs != null && isWithinMonth(billingToDoneMs, args.range)) {
      if (balanceDue == null) {
        notes.push(`Billing->Done transition found but Balance Due missing for task ${task.id} => treated as 0`);
      } else {
        billingReleaseGross += balanceDue;
      }
      billingReleaseCount += 1;
    }

    // A) Deposits: deposit-paid comment in month
    if (commentLookups >= maxCommentLookups) {
      notes.push(`Comment lookups capped at ${maxCommentLookups}; expected revenue may be incomplete`);
      break;
    }

    let depositPaidMs: number | null = null;
    try {
      depositPaidMs = extractDepositPaidTimestampMs(await getTaskComments());
    } catch (e) {
      notes.push(`Deposit comment parse failed for task ${task.id}: ${(e as Error).message}`);
      depositPaidMs = null;
    }

    if (depositPaidMs != null && isWithinMonth(depositPaidMs, args.range)) {
      if (depositValue == null) {
        notes.push(`Deposit comment found but Deposit field missing for task ${task.id} => treated as 0`);
      } else {
        depositsGross += depositValue;
      }
      depositCount += 1;
    }

    // B) Scheduled balances: requestedDate in month, status != Billing, and dedupe against billing->done tasks
    const inEventMonth = eventDateMs != null && isWithinMonth(eventDateMs, args.range);
    const isBilling = ciEquals(status, 'billing');
    const excludedByDedupe = billingToDoneMs != null;

    if (inEventMonth && !isBilling && !excludedByDedupe) {
      if (balanceDue == null) {
        notes.push(`Scheduled event in month but Balance Due missing for task ${task.id} => treated as 0`);
      } else {
        scheduledBalancesGross += balanceDue;
      }
      scheduledCount += 1;
    }
  }

  notes.push('Expected Revenue v2.0: A=Deposits (comment month) + B=Scheduled Balances (event month, status!=Billing) + C=Billing->Done releases (transition month)');
  notes.push(
    `Expected Revenue breakdown: deposits=${depositsGross} (${depositCount} tasks), scheduledBalances=${scheduledBalancesGross} (${scheduledCount} tasks), billingReleases=${billingReleaseGross} (${billingReleaseCount} tasks)`,
  );
  notes.push('Budget treated as gross ILS; net computed with VAT 18%');

  const totals = ensureNetGross({ grossILS: depositsGross + scheduledBalancesGross + billingReleaseGross, netILS: null });
  return { gross: totals.grossILS ?? 0, net: totals.netILS ?? 0, notes };
}

export async function computeDashboard(month: YYYYMM, deps: ComputeDashboardDeps): Promise<DashboardMetrics> {
  const computedAt = deps.computedAt ?? new Date();
  const range = getMonthRange(month);

  const [leadTasks, eventTasks, expenseTasks] = await Promise.all([
    fetchIncomingLeads(deps.clickup),
    fetchEventCalendar(deps.clickup),
    fetchExpenses(deps.clickup),
  ]);

  const leads = leadTasks.map(normalizeIncomingLead);
  const events = eventTasks.map(normalizeEvent);
  const expenses = expenseTasks.map(normalizeExpense);

  // Production ClickUp automation can move Closed Won tasks out of Incoming Leads into Event Calendar,
  // changing status to "booked". To keep closures + revenue correct, we treat the ClickBot move comment
  // timestamp as the effective close date for those moved deals.
  const leadIds = new Set(leadTasks.map((t) => t.id));
  const maxCommentLookups = 60;
  const extraClosedWon: Array<{ closeMs: number | null; budgetGrossILS: number | null; notes?: string[] }> = [];
  const extraClosedWonCloseMs: Array<number | null> = [];

  const candidateEventTasks = eventTasks.filter((t) => !leadIds.has(t.id));

  const commentCache = new Map<string, ClickUpTaskComment[]>();
  async function getComments(taskId: string): Promise<ClickUpTaskComment[]> {
    const cached = commentCache.get(taskId);
    if (cached) return cached;
    const comments = await deps.clickup.getTaskComments(taskId);
    commentCache.set(taskId, comments);
    return comments;
  }

  function readBudgetGrossILS(task: { custom_fields?: Array<{ id: string; value?: unknown }> }): number | null {
    const field = task.custom_fields?.find((f) => f.id === CLICKUP.fields.budget);
    const v = field?.value;
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const asNum = Number(v);
    return Number.isFinite(asNum) ? asNum : null;
  }

  // Keep API usage bounded: only inspect tasks updated within the month, and cap lookups.
  for (const task of candidateEventTasks) {
    if (extraClosedWon.length >= maxCommentLookups) break;

    const updatedMs = parseTaskMs(task.date_updated);
    if (updatedMs == null || updatedMs < range.startMs || updatedMs >= range.endExclusiveMs) continue;

    const moveMs = await getClosedWonMoveTimestampMs(deps.clickup, task.id);
    if (moveMs == null) continue;

    const effectiveCloseMs = moveMs ?? updatedMs;
    extraClosedWonCloseMs.push(effectiveCloseMs);
    extraClosedWon.push({
      closeMs: effectiveCloseMs,
      budgetGrossILS: readBudgetGrossILS(task),
      notes: ['Close date from ClickBot move-to-Event-Calendar comment'],
    });
  }

  const eventRevenue = await computeMonthlyRevenueFromEventCalendar({
    range,
    getComments,
    eventTasks,
  });

  const expectedRevenueV2 = await computeExpectedRevenueV2FromEventCalendar({
    range,
    getComments,
    eventTasks,
  });

  const financialCore = computeFinancialMetrics({ month, range, leads, expenses, extraClosedWon });
  const financial = {
    ...financialCore,
    monthlyRevenue: currencyMetric('clickup', { grossILS: eventRevenue.gross, netILS: eventRevenue.net }, eventRevenue.notes),
    expectedCashflow: currencyMetric('clickup', { grossILS: expectedRevenueV2.gross, netILS: expectedRevenueV2.net }, expectedRevenueV2.notes),
  };
  const marketingCore = computeMarketingMetrics({ month, range, leads });
  const sales = computeSalesMetrics({ month, range, leads, monthlyRevenue: financial.monthlyRevenue, extraClosedWonCloseMs });
  const operations = computeOperationsMetrics({ month, range, leads, events, computedAt });

  // Followers metrics (current + previous month only)
  const nowMonth = monthFromDateUTC(computedAt);
  const prevNowMonth = getPreviousMonth(nowMonth);

  let followersEndOfMonthValue: number | null = null;
  let followersDeltaValue: number | null = null;
  const followerNotes: string[] = [];

  if (!deps.instagram) {
    followerNotes.push('Instagram client not configured');
  } else if (month !== nowMonth && month !== prevNowMonth) {
    followerNotes.push('Followers metrics supported only for current + previous month (insights window)');
  } else {
    try {
      const seriesMonth = await deps.instagram.getFollowerCountSeries({ sinceMs: range.startMs, untilMs: range.endExclusiveMs });
      followersEndOfMonthValue = pickLastInMonth(seriesMonth, range);

      if (followersEndOfMonthValue == null) {
        followerNotes.push('No follower_count samples returned for month range');
      }

      if (month === nowMonth) {
        const prevRange = getMonthRange(prevNowMonth);
        const seriesPrev = await deps.instagram.getFollowerCountSeries({ sinceMs: prevRange.startMs, untilMs: prevRange.endExclusiveMs });
        const prevEnd = pickLastInMonth(seriesPrev, prevRange);
        if (prevEnd == null || followersEndOfMonthValue == null) {
          followersDeltaValue = null;
          followerNotes.push('Delta not computable (missing sample for current or previous month)');
        } else {
          followersDeltaValue = followersEndOfMonthValue - prevEnd;
        }
      } else {
        followersDeltaValue = null;
        followerNotes.push('Delta for previous month requires month-2, outside supported window');
      }
    } catch (e) {
      followerNotes.push(`Instagram fetch failed: ${(e as Error).message}`);
      followersEndOfMonthValue = null;
      followersDeltaValue = null;
    }
  }

  const followersEndOfMonth = countMetric('instagram', followersEndOfMonthValue, followerNotes.length ? followerNotes : undefined);
  const followersDeltaMonth = countMetric('instagram', followersDeltaValue, followerNotes.length ? followerNotes : undefined);

  return {
    version: 'v1',
    month,
    computedAt: computedAt.toISOString(),

    financial,
    marketing: {
      ...marketingCore,
      followersEndOfMonth,
      followersDeltaMonth,
    },
    sales,
    operations,
  };
}
