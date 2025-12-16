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

  const financial = computeFinancialMetrics({ month, range, leads, expenses });
  const marketingCore = computeMarketingMetrics({ month, range, leads });
  const sales = computeSalesMetrics({ month, range, leads, monthlyRevenue: financial.monthlyRevenue });
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
