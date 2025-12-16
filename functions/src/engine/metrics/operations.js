"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOperationsMetrics = computeOperationsMetrics;
const dataContract_1 = require("../config/dataContract");
const month_1 = require("../time/month");
const helpers_1 = require("./helpers");
function getCloseMs(lead) {
    return lead.closedMs ?? lead.updatedMs ?? null;
}
function computeOperationsMetrics(input) {
    const nowMs = input.computedAt.getTime();
    // Active customers: Event Calendar tasks with status in {booked, staffing, logistics, ready} and eventDate >= now
    const activeStatuses = new Set([
        dataContract_1.CLICKUP_STATUS.booked.toLowerCase(),
        dataContract_1.CLICKUP_STATUS.staffing.toLowerCase(),
        dataContract_1.CLICKUP_STATUS.logistics.toLowerCase(),
        dataContract_1.CLICKUP_STATUS.ready.toLowerCase(),
    ]);
    let active = 0;
    for (const ev of input.events) {
        const status = ev.status?.toLowerCase() ?? null;
        if (!status || !activeStatuses.has(status))
            continue;
        if (ev.requestedDateMs == null)
            continue;
        if (ev.requestedDateMs >= nowMs)
            active += 1;
    }
    // Cancellations v1: current status == Cancelled AND date_updated in month
    let cancellations = 0;
    for (const ev of input.events) {
        if (!(0, helpers_1.ciEquals)(ev.status, dataContract_1.CLICKUP_STATUS.cancelled))
            continue;
        if (ev.updatedMs == null)
            continue;
        if ((0, month_1.isWithinMonth)(ev.updatedMs, input.range))
            cancellations += 1;
    }
    // Referrals Word of Mouth: Incoming Leads created in month where Source = Word of Mouth
    let referrals = 0;
    for (const lead of input.leads) {
        if (lead.createdMs == null || !(0, month_1.isWithinMonth)(lead.createdMs, input.range))
            continue;
        if ((0, helpers_1.ciEquals)(lead.source, dataContract_1.CLICKUP_SOURCE.wordOfMouth))
            referrals += 1;
    }
    // Returning customers: phone of lead created in month exists in ANY historical Closed Won
    const historicalClosedWonPhones = new Set();
    const returningPhonesThisMonth = new Set();
    for (const lead of input.leads) {
        if (!(0, helpers_1.ciEquals)(lead.status, dataContract_1.CLICKUP_STATUS.closedWon))
            continue;
        const closeMs = getCloseMs(lead);
        if (closeMs == null || closeMs >= input.range.startMs)
            continue;
        if (lead.phoneNormalized)
            historicalClosedWonPhones.add(lead.phoneNormalized);
    }
    for (const lead of input.leads) {
        if (lead.createdMs == null || !(0, month_1.isWithinMonth)(lead.createdMs, input.range))
            continue;
        if (!lead.phoneNormalized)
            continue;
        if (historicalClosedWonPhones.has(lead.phoneNormalized))
            returningPhonesThisMonth.add(lead.phoneNormalized);
    }
    const activeCustomers = (0, helpers_1.countMetric)('clickup', active, ['Event Calendar: statuses {booked, staffing, logistics, ready} and eventDate >= computedAt']);
    const cancellationsMetric = (0, helpers_1.countMetric)('clickup', cancellations, ['v1: status == Cancelled and date_updated in month']);
    const referralsWordOfMouth = (0, helpers_1.countMetric)('clickup', referrals, ['Incoming Leads: Source = Word of Mouth, created in month']);
    const returningCustomers = (0, helpers_1.countMetric)('clickup', returningPhonesThisMonth.size, ['Unique normalized phones created in month that match historical Closed Won phones']);
    return {
        activeCustomers,
        cancellations: cancellationsMetric,
        referralsWordOfMouth,
        returningCustomers,
    };
}
