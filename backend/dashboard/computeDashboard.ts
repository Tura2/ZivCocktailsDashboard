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
import { countMetric } from '../metrics/helpers';
import { getClosedWonMoveTimestampMs } from '../clickup/comments';
import { CLICKUP } from '../config/dataContract';

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

  function parseTaskMs(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
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

  const financial = computeFinancialMetrics({ month, range, leads, expenses, extraClosedWon });
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
