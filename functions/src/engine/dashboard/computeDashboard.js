"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDashboard = computeDashboard;
const fetchLists_1 = require("../clickup/fetchLists");
const month_1 = require("../time/month");
const clickup_1 = require("../normalize/clickup");
const financial_1 = require("../metrics/financial");
const marketing_1 = require("../metrics/marketing");
const sales_1 = require("../metrics/sales");
const operations_1 = require("../metrics/operations");
const helpers_1 = require("../metrics/helpers");
function monthFromDateUTC(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
function pickLastInMonth(series, range) {
    let last = null;
    for (const sample of series) {
        const ms = Date.parse(sample.endTimeIso);
        if (!Number.isFinite(ms))
            continue;
        if (ms < range.startMs || ms >= range.endExclusiveMs)
            continue;
        if (!last || ms > last.ms)
            last = { ms, value: sample.value };
    }
    return last ? last.value : null;
}
async function computeDashboard(month, deps) {
    const computedAt = deps.computedAt ?? new Date();
    const range = (0, month_1.getMonthRange)(month);
    const [leadTasks, eventTasks, expenseTasks] = await Promise.all([
        (0, fetchLists_1.fetchIncomingLeads)(deps.clickup),
        (0, fetchLists_1.fetchEventCalendar)(deps.clickup),
        (0, fetchLists_1.fetchExpenses)(deps.clickup),
    ]);
    const leads = leadTasks.map(clickup_1.normalizeIncomingLead);
    const events = eventTasks.map(clickup_1.normalizeEvent);
    const expenses = expenseTasks.map(clickup_1.normalizeExpense);
    const financial = (0, financial_1.computeFinancialMetrics)({ month, range, leads, expenses });
    const marketingCore = (0, marketing_1.computeMarketingMetrics)({ month, range, leads });
    const sales = (0, sales_1.computeSalesMetrics)({ month, range, leads, monthlyRevenue: financial.monthlyRevenue });
    const operations = (0, operations_1.computeOperationsMetrics)({ month, range, leads, events, computedAt });
    // Followers metrics (current + previous month only)
    const nowMonth = monthFromDateUTC(computedAt);
    const prevNowMonth = (0, month_1.getPreviousMonth)(nowMonth);
    let followersEndOfMonthValue = null;
    let followersDeltaValue = null;
    const followerNotes = [];
    if (!deps.instagram) {
        followerNotes.push('Instagram client not configured');
    }
    else if (month !== nowMonth && month !== prevNowMonth) {
        followerNotes.push('Followers metrics supported only for current + previous month (insights window)');
    }
    else {
        try {
            const seriesMonth = await deps.instagram.getFollowerCountSeries({ sinceMs: range.startMs, untilMs: range.endExclusiveMs });
            followersEndOfMonthValue = pickLastInMonth(seriesMonth, range);
            if (followersEndOfMonthValue == null) {
                followerNotes.push('No follower_count samples returned for month range');
            }
            if (month === nowMonth) {
                const prevRange = (0, month_1.getMonthRange)(prevNowMonth);
                const seriesPrev = await deps.instagram.getFollowerCountSeries({ sinceMs: prevRange.startMs, untilMs: prevRange.endExclusiveMs });
                const prevEnd = pickLastInMonth(seriesPrev, prevRange);
                if (prevEnd == null || followersEndOfMonthValue == null) {
                    followersDeltaValue = null;
                    followerNotes.push('Delta not computable (missing sample for current or previous month)');
                }
                else {
                    followersDeltaValue = followersEndOfMonthValue - prevEnd;
                }
            }
            else {
                followersDeltaValue = null;
                followerNotes.push('Delta for previous month requires month-2, outside supported window');
            }
        }
        catch (e) {
            followerNotes.push(`Instagram fetch failed: ${e.message}`);
            followersEndOfMonthValue = null;
            followersDeltaValue = null;
        }
    }
    const followersEndOfMonth = (0, helpers_1.countMetric)('instagram', followersEndOfMonthValue, followerNotes.length ? followerNotes : undefined);
    const followersDeltaMonth = (0, helpers_1.countMetric)('instagram', followersDeltaValue, followerNotes.length ? followerNotes : undefined);
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
