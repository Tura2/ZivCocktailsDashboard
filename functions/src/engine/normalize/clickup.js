"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIncomingLead = normalizeIncomingLead;
exports.normalizeEvent = normalizeEvent;
exports.normalizeExpense = normalizeExpense;
const dataContract_1 = require("../config/dataContract");
const phone_1 = require("./phone");
function getCustomField(task, fieldId) {
    return task.custom_fields?.find((f) => f.id === fieldId);
}
function getString(task, fieldId) {
    const field = getCustomField(task, fieldId);
    const v = field?.value;
    if (v == null)
        return null;
    if (typeof v === 'string')
        return v;
    return String(v);
}
function getNumber(task, fieldId) {
    const field = getCustomField(task, fieldId);
    const v = field?.value;
    if (v == null)
        return null;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    // ClickUp sometimes returns currency/number as string
    const asNum = Number(v);
    return Number.isFinite(asNum) ? asNum : null;
}
function getDateMs(task, fieldId) {
    const n = getNumber(task, fieldId);
    return n == null ? null : Math.trunc(n);
}
function parseTaskMs(raw) {
    if (!raw)
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}
function normalizeIncomingLead(task) {
    return {
        id: task.id,
        status: task.status?.status ?? null,
        createdMs: parseTaskMs(task.date_created),
        updatedMs: parseTaskMs(task.date_updated),
        closedMs: parseTaskMs(task.date_closed ?? undefined),
        phoneNormalized: (0, phone_1.normalizePhone)(getString(task, dataContract_1.CLICKUP.fields.phone)),
        source: getString(task, dataContract_1.CLICKUP.fields.source),
        lossReason: getString(task, dataContract_1.CLICKUP.fields.lossReason),
        budgetGrossILS: getNumber(task, dataContract_1.CLICKUP.fields.budget),
        paidAmountGrossILS: getNumber(task, dataContract_1.CLICKUP.fields.paidAmount),
        requestedDateMs: getDateMs(task, dataContract_1.CLICKUP.fields.requestedDate),
    };
}
function normalizeEvent(task) {
    return {
        id: task.id,
        status: task.status?.status ?? null,
        updatedMs: parseTaskMs(task.date_updated),
        requestedDateMs: getDateMs(task, dataContract_1.CLICKUP.fields.requestedDate),
        phoneNormalized: (0, phone_1.normalizePhone)(getString(task, dataContract_1.CLICKUP.fields.phone)),
    };
}
function normalizeExpense(task) {
    return {
        id: task.id,
        expenseDateMs: getDateMs(task, dataContract_1.CLICKUP.fields.expenseDate),
        amountGrossILS: getNumber(task, dataContract_1.CLICKUP.fields.expenseAmount),
    };
}
