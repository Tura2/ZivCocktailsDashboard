import type { CountMetric, CurrencyMetric, PercentMetric, YYYYMM } from '../dashboard/types';
import { CLICKUP_STATUS, CLICKUP } from '../config/dataContract';
import type { NormalizedLead } from '../normalize/clickup';
import type { MonthRange } from '../time/month';
import { isWithinMonth } from '../time/month';
import { ciEquals, countMetric, currencyMetric, percentMetric } from './helpers';
import type { ClickUpTask, ClickUpTaskComment } from '../clickup/types';
import { extractClosedWonMoveTimestampMs } from '../clickup/comments';

export interface SalesMetricsInput {
  month: YYYYMM;
  range: MonthRange;
  leads: ReadonlyArray<NormalizedLead>;
  monthlyRevenue: CurrencyMetric;
  extraClosedWonCloseMs?: ReadonlyArray<number | null>;
  eventTasks?: ReadonlyArray<ClickUpTask>;
  getComments?: (taskId: string) => Promise<ClickUpTaskComment[]>;
  closedWonEventsInMonth?: ReadonlyArray<ClosedWonEventInMonth>;
}

export interface SalesMetricsOutput {
  avgRevenuePerDeal: CurrencyMetric;
  salesCalls: CountMetric;
  closures: CountMetric;
  closeRatePct: PercentMetric;
}

export type ClosedWonEventInMonth = {
  id: string;
  name: string;
  budgetGrossILS: number;
  closeMs: number;
};

function getCloseMs(lead: NormalizedLead): number | null {
  return lead.closedMs ?? lead.updatedMs ?? null;
}

function readBudgetFromTask(task: ClickUpTask): number | null {
  const field = task.custom_fields?.find((f) => f.id === CLICKUP.fields.budget);
  const v = field?.value;
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const asNum = Number(v);
  return Number.isFinite(asNum) ? asNum : null;
}

function parseTaskMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function extractClosedWonEventsInMonth(
  eventTasks: ReadonlyArray<ClickUpTask>,
  getComments: (taskId: string) => Promise<ClickUpTaskComment[]>,
  range: MonthRange,
): Promise<ClosedWonEventInMonth[]> {
  const result: ClosedWonEventInMonth[] = [];
  const maxLookups = 100;
  let lookups = 0;

  for (const task of eventTasks) {
    if (lookups >= maxLookups) break;

    // Check if task was updated in the month to optimize comment lookups
    const updatedMs = parseTaskMs(task.date_updated);
    if (updatedMs == null || updatedMs < range.startMs || updatedMs >= range.endExclusiveMs) continue;

    lookups += 1;
    const comments = await getComments(task.id);
    const closeMs = extractClosedWonMoveTimestampMs(comments);

    // If closed won move comment found and it's in the month
    if (closeMs != null && isWithinMonth(closeMs, range)) {
      const budget = readBudgetFromTask(task);
      if (budget != null && budget > 0) {
        result.push({ id: task.id, name: task.name ?? '(untitled)', budgetGrossILS: budget, closeMs });
      }
    }
  }

  return result;
}

export async function computeSalesMetrics(input: SalesMetricsInput): Promise<SalesMetricsOutput> {
  let salesCallsCount = 0;
  let closuresCount = 0;

  for (const lead of input.leads) {
    // salesCalls: leads created in month where status != New Lead
    if (lead.createdMs != null && isWithinMonth(lead.createdMs, input.range)) {
      if (lead.status != null && !ciEquals(lead.status, CLICKUP_STATUS.newLead)) {
        salesCallsCount += 1;
      }
    }

    // closures: Closed Won in month by close date
    if (ciEquals(lead.status, CLICKUP_STATUS.closedWon)) {
      const closeMs = getCloseMs(lead);
      if (closeMs != null && isWithinMonth(closeMs, input.range)) {
        closuresCount += 1;
      }
    }
  }

  for (const closeMs of input.extraClosedWonCloseMs ?? []) {
    if (closeMs != null && isWithinMonth(closeMs, input.range)) {
      closuresCount += 1;
    }
  }

  // Extract closed won events from event calendar (moved from Incoming Leads by ClickBot)
  let closedWonEvents: ClosedWonEventInMonth[] = [];
  if (input.closedWonEventsInMonth) {
    closedWonEvents = [...input.closedWonEventsInMonth];
    closuresCount += closedWonEvents.length;
  } else if (input.eventTasks && input.getComments) {
    closedWonEvents = await extractClosedWonEventsInMonth(input.eventTasks, input.getComments, input.range);
    closuresCount += closedWonEvents.length;
  }

  const avgNotes: string[] = [];
  let avgGross: number | null = null;
  let avgNet: number | null = null;

  if (closuresCount === 0) {
    avgNotes.push('closedWonCount == 0 => null');
  } else {
    // Sum budgets from closed won events in event calendar
    const eventBudgetsSum = closedWonEvents.reduce((sum, evt) => sum + evt.budgetGrossILS, 0);
    
    if (eventBudgetsSum > 0) {
      // Use event calendar budgets for avg calculation
      avgGross = eventBudgetsSum / closedWonEvents.length;
      avgNet = avgGross / 1.18; // Apply VAT deduction
      avgNotes.push(`Avg from Event Calendar closed won events: ${closedWonEvents.length} events, total budget ${eventBudgetsSum} ILS`);
    } else if (input.monthlyRevenue.grossILS == null || input.monthlyRevenue.netILS == null) {
      avgNotes.push('monthlyRevenue missing and no event calendar budgets => null');
    } else {
      avgGross = input.monthlyRevenue.grossILS / closuresCount;
      avgNet = input.monthlyRevenue.netILS / closuresCount;
      avgNotes.push('Fallback to monthlyRevenue / closuresCount');
    }
  }

  const avgRevenuePerDeal = currencyMetric('computed', { grossILS: avgGross, netILS: avgNet }, avgNotes);
  const salesCalls = countMetric('clickup', salesCallsCount, ['Leads created in month where status != New Lead']);
  const closures = countMetric('clickup', closuresCount, ['Closed Won deals with closeDate in month']);

  const closeRatePct = percentMetric(
    'computed',
    salesCallsCount === 0 ? null : (closuresCount / salesCallsCount) * 100,
    salesCallsCount === 0 ? ['salesCalls == 0 => null'] : undefined,
  );

  return { avgRevenuePerDeal, salesCalls, closures, closeRatePct };
}
