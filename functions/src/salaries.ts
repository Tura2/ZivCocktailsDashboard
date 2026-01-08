import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN } from './config/secrets';
import { clickupRequest } from './sync/clients';
import { readJsonBody, sendJson, methodNotAllowed } from './sync/http';
import { getDb } from './refresh/firebaseAdmin';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

// Locked per docs/EMPLOYER_EVENTS_CALC.md
const LIST_IDS = {
  eventCalendar: '901214362128',
  staffDirectory: '901214362129',
} as const;

const FIELD_IDS = {
  assignedStaff: '61f29c83-d538-4d62-97bb-c221572d2c47',
  requestedDate: '1660701a-1263-41cf-bb7a-79e3c3638aa3',
  recommendation: 'f11a51df-9a01-4eea-8d2f-dab88217d985',
  phone: 'b9781217-a9fc-44e1-b152-c11f193c8839',
} as const;

const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

type ClickUpTask = any;

type SalaryEvent = {
  taskId: string;
  name: string;
  requestedDateMs: number;
  recommendation: boolean | null;
};

type SalariesRow = {
  staffTaskId: string;
  name: string;
  phone: string | null;

  currentBalance: number;

  baseRate: number;
  videosCount: number;
  videoRate: number;
  bonus: number;

  eventCount: number;
  events: SalaryEvent[];

  eventsTotal: number;
  videosTotal: number;
  total: number;

  paymentStatus: 'unpaid' | 'partial' | 'paid';

  processedAt: string | null;
  processedAmount: number | null;
};

function isValidMonthKey(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim());
}

function toPaymentDocId(month: string): string {
  return month.replace('-', '_');
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) {
    const local = digits.slice(3);
    return local.startsWith('0') ? local : `0${local}`;
  }
  if (digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

function getCustomField(task: ClickUpTask, fieldId: string): any | undefined {
  const fields = Array.isArray(task?.custom_fields) ? task.custom_fields : [];
  return fields.find((f: any) => f?.id === fieldId);
}

function getCustomFieldValue(task: ClickUpTask, fieldId: string): any {
  return getCustomField(task, fieldId)?.value;
}

function readRequestedDateMs(task: ClickUpTask): number | null {
  const v = getCustomFieldValue(task, FIELD_IDS.requestedDate);
  const n = safeNumber(v, NaN);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function readRecommendation(task: ClickUpTask): boolean | null {
  const v = getCustomFieldValue(task, FIELD_IDS.recommendation);

  if (v === true) return true;
  if (v === false) return false;

  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;

  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }

  return null;
}

function monthKeyFromMs(ms: number, timezone: string): string {
  const d = new Date(ms);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' });
  // en-CA yields YYYY-MM
  return fmt.format(d);
}

function isDone(task: ClickUpTask): boolean {
  const s = String(task?.status?.status ?? '').trim().toLowerCase();
  return s === 'done';
}

function isDoneOrBilling(task: ClickUpTask): boolean {
  const s = String(task?.status?.status ?? '').trim().toLowerCase();
  return s === 'done' || s === 'billing';
}

function extractAssignedStaffIds(task: ClickUpTask): string[] {
  const v = getCustomFieldValue(task, FIELD_IDS.assignedStaff);
  if (!v) return [];

  const out: string[] = [];
  const arr = Array.isArray(v) ? v : [];

  for (const item of arr) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim());
      continue;
    }
    const id = (item && typeof item === 'object') ? (item as any).id : null;
    if (typeof id === 'string' && id.trim()) out.push(id.trim());
  }

  return out;
}

async function fetchAllTasks(listId: string): Promise<ClickUpTask[]> {
  const out: ClickUpTask[] = [];
  let page = 0;

  while (true) {
    const url = `${CLICKUP_API_URL}/list/${listId}/task`;
    const data = await clickupRequest<{ tasks?: any[] }>('GET', url, {
      query: {
        page: String(page),
        include_closed: 'true',
        subtasks: 'true',
        archived: 'false',
      },
    });

    const tasks = Array.isArray((data as any)?.tasks) ? (data as any).tasks : [];
    if (!tasks.length) break;

    out.push(...tasks);

    // ClickUp list tasks page size is typically 100.
    if (tasks.length < 100) break;
    page += 1;
  }

  return out;
}

async function buildMonthlyRows(month: string, timezone: string): Promise<SalariesRow[]> {
  const [staffTasks, eventTasks] = await Promise.all([
    fetchAllTasks(LIST_IDS.staffDirectory),
    fetchAllTasks(LIST_IDS.eventCalendar),
  ]);

  const staffById = new Map<string, { id: string; name: string; phone: string | null }>();
  for (const t of staffTasks) {
    const id = String(t?.id ?? '').trim();
    if (!id) continue;
    const name = String(t?.name ?? '').trim();
    const phoneRaw = getCustomFieldValue(t, FIELD_IDS.phone);
    staffById.set(id, { id, name, phone: normalizePhone(phoneRaw) });
  }

  const eventsByStaff = new Map<string, SalaryEvent[]>();

  for (const t of eventTasks) {
    if (!isDoneOrBilling(t)) continue;

    const requestedDateMs = readRequestedDateMs(t);
    if (requestedDateMs == null) continue;

    const mk = monthKeyFromMs(requestedDateMs, timezone);
    if (mk !== month) continue;

    const staffIds = extractAssignedStaffIds(t);
    if (!staffIds.length) continue;

    const ev: SalaryEvent = {
      taskId: String(t?.id ?? '').trim(),
      name: String(t?.name ?? '').trim(),
      requestedDateMs,
      recommendation: readRecommendation(t),
    };

    for (const staffId of staffIds) {
      if (!staffId) continue;
      const list = eventsByStaff.get(staffId) ?? [];
      list.push(ev);
      eventsByStaff.set(staffId, list);
    }
  }

  const staffIds = Array.from(staffById.keys());

  const db = getDb();
  const employeeRefs = staffIds.map((id) => db.collection('employees').doc(id));
  const employeeSnaps = employeeRefs.length ? await db.getAll(...employeeRefs) : [];

  const paymentDocId = toPaymentDocId(month);
  const paymentRefs = staffIds.map((id) => db.collection('employees').doc(id).collection('payments').doc(paymentDocId));
  const paymentSnaps = paymentRefs.length ? await db.getAll(...paymentRefs) : [];

  const employeeById = new Map<string, any>();
  for (const s of employeeSnaps) employeeById.set(s.id, s.exists ? s.data() : null);

  const paymentById = new Map<string, any>();
  for (const s of paymentSnaps) paymentById.set(s.ref.parent.parent?.id ?? s.id, s.exists ? s.data() : null);

  const rows: SalariesRow[] = [];

  for (const staffId of staffIds) {
    const staff = staffById.get(staffId);
    if (!staff) continue;

    const emp = employeeById.get(staffId) ?? null;
    const pay = paymentById.get(staffId) ?? null;

    const currentBalance = Math.max(0, safeNumber(emp?.currentBalance, 0));

    const baseRate = Math.max(0, Math.trunc(safeNumber(pay?.baseRate ?? emp?.baseRate, 0)));
    const videoRate = Math.max(0, Math.trunc(safeNumber(pay?.videoRate ?? emp?.videoRate, 50)));
    const bonus = Math.max(0, safeNumber(pay?.bonus, 0));
    const paymentStatus: 'unpaid' | 'partial' | 'paid' =
      pay?.status === 'paid' || pay?.status === 'partial' ? pay.status : 'unpaid';

    const processedAt = typeof pay?.processedAt === 'string' && pay.processedAt.trim() ? pay.processedAt.trim() : null;
    const processedAmount = processedAt ? safeNumber(pay?.processedAmount, null as any) : null;

    const events = (eventsByStaff.get(staffId) ?? []).slice().sort((a, b) => a.requestedDateMs - b.requestedDateMs);
    const eventCount = events.length;

    const computedVideosCount = Math.max(0, events.reduce((acc, ev) => acc + (ev.recommendation === true ? 1 : 0), 0));
    const videosCount = Math.max(0, Math.trunc(safeNumber(pay?.videosCount, computedVideosCount)));

    const eventsTotal = eventCount * baseRate;
    const videosTotal = videosCount * videoRate;
    const total = eventsTotal + videosTotal + bonus;

    rows.push({
      staffTaskId: staffId,
      name: staff.name,
      phone: staff.phone,
      currentBalance,
      baseRate,
      videosCount,
      videoRate,
      bonus,
      eventCount,
      events,
      eventsTotal,
      videosTotal,
      total,
      paymentStatus,
      processedAt,
      processedAmount: typeof processedAmount === 'number' && Number.isFinite(processedAmount) ? processedAmount : null,
    });
  }

  rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  return rows;
}

const corsMiddleware = createCorsMiddlewareForRefresh();

export const salaries = onRequest(
  {
    region: 'me-west1',
    concurrency: 20,
    timeoutSeconds: 60,
    secrets: [CLICKUP_API_TOKEN],
  },
  async (req: Request, res: Response) => {
    await runCors(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      methodNotAllowed(res, ['POST', 'OPTIONS']);
      return;
    }

    try {
      await requireAllowlistedCaller(req);

      const body = readJsonBody(req);
      const monthRaw = body?.month;
      const timezone = typeof body?.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : DEFAULT_TIMEZONE;

      if (!isValidMonthKey(monthRaw)) {
        throw new HttpError(400, 'Invalid month. Expected YYYY-MM', 'invalid_month');
      }

      const month = monthRaw.trim();

      const rows = await buildMonthlyRows(month, timezone);

      sendJson(res, 200, {
        month,
        timezone,
        rows,
      });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }

      const err = e as any;
      console.error('salaries failed', {
        message: String(err?.message ?? 'Salaries failed'),
        name: String(err?.name ?? ''),
        stack: typeof err?.stack === 'string' ? err.stack : undefined,
      });
      sendJson(res, 500, { error: { message: String(err?.message ?? 'Salaries failed') } });
    }
  },
);
