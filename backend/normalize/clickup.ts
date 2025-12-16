import type { ClickUpCustomField, ClickUpTask } from '../clickup/types';
import { CLICKUP } from '../config/dataContract';
import { normalizePhone } from './phone';

function getCustomField(task: ClickUpTask, fieldId: string): ClickUpCustomField | undefined {
  return task.custom_fields?.find((f) => f.id === fieldId);
}

function getString(task: ClickUpTask, fieldId: string): string | null {
  const field = getCustomField(task, fieldId);
  const v = field?.value;
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return String(v);
}

function getNumber(task: ClickUpTask, fieldId: string): number | null {
  const field = getCustomField(task, fieldId);
  const v = field?.value;
  if (v == null) return null;

  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  // ClickUp sometimes returns currency/number as string
  const asNum = Number(v);
  return Number.isFinite(asNum) ? asNum : null;
}

function getDateMs(task: ClickUpTask, fieldId: string): number | null {
  const n = getNumber(task, fieldId);
  return n == null ? null : Math.trunc(n);
}

function parseTaskMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export interface NormalizedLead {
  id: string;
  status: string | null;
  createdMs: number | null;
  updatedMs: number | null;
  closedMs: number | null;

  phoneNormalized: string | null;
  source: string | null;
  lossReason: string | null;

  budgetGrossILS: number | null; // Budget (single field) treated as gross for v1
  paidAmountGrossILS: number | null; // Paid Amount treated as gross for v1

  requestedDateMs: number | null; // event date proxy
}

export interface NormalizedEvent {
  id: string;
  status: string | null;
  updatedMs: number | null;
  requestedDateMs: number | null; // event date
  phoneNormalized: string | null;
}

export interface NormalizedExpense {
  id: string;
  expenseDateMs: number | null;
  amountGrossILS: number | null; // single field treated as gross
}

export function normalizeIncomingLead(task: ClickUpTask): NormalizedLead {
  return {
    id: task.id,
    status: task.status?.status ?? null,
    createdMs: parseTaskMs(task.date_created),
    updatedMs: parseTaskMs(task.date_updated),
    closedMs: parseTaskMs(task.date_closed ?? undefined),

    phoneNormalized: normalizePhone(getString(task, CLICKUP.fields.phone)),
    source: getString(task, CLICKUP.fields.source),
    lossReason: getString(task, CLICKUP.fields.lossReason),

    budgetGrossILS: getNumber(task, CLICKUP.fields.budget),
    paidAmountGrossILS: getNumber(task, CLICKUP.fields.paidAmount),

    requestedDateMs: getDateMs(task, CLICKUP.fields.requestedDate),
  };
}

export function normalizeEvent(task: ClickUpTask): NormalizedEvent {
  return {
    id: task.id,
    status: task.status?.status ?? null,
    updatedMs: parseTaskMs(task.date_updated),
    requestedDateMs: getDateMs(task, CLICKUP.fields.requestedDate),
    phoneNormalized: normalizePhone(getString(task, CLICKUP.fields.phone)),
  };
}

export function normalizeExpense(task: ClickUpTask): NormalizedExpense {
  return {
    id: task.id,
    expenseDateMs: getDateMs(task, CLICKUP.fields.expenseDate),
    amountGrossILS: getNumber(task, CLICKUP.fields.expenseAmount),
  };
}
