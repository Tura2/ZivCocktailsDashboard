import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN } from './config/secrets';
import { readJsonBody, sendJson, methodNotAllowed } from './sync/http';
import { getDb } from './refresh/firebaseAdmin';

const corsMiddleware = createCorsMiddlewareForRefresh();

type SalaryEvent = { taskId: string; name: string; requestedDateMs: number };

type SavePayload = {
  month: string; // YYYY-MM
  staffTaskId: string;
  baseRate: number;
  videosCount: number;
  bonus: number;
  status?: 'unpaid' | 'partial' | 'paid';
  events?: SalaryEvent[];
};

function isValidMonthKey(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim());
}

function toPaymentDocId(month: string): string {
  return month.replace('-', '_');
}

function toIntNonNeg(v: unknown, label: string): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${label}`, `invalid_${label}`);
  const i = Math.trunc(n);
  if (i < 0) throw new HttpError(400, `${label} must be >= 0`, `invalid_${label}`);
  return i;
}

function toNumNonNeg(v: unknown, label: string): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${label}`, `invalid_${label}`);
  if (n < 0) throw new HttpError(400, `${label} must be >= 0`, `invalid_${label}`);
  return n;
}

function normalizeEvents(raw: unknown): SalaryEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: SalaryEvent[] = [];
  for (const e of arr) {
    const taskId = String((e as any)?.taskId ?? '').trim();
    const name = String((e as any)?.name ?? '').trim();
    const requestedDateMs = Math.trunc(Number((e as any)?.requestedDateMs ?? NaN));
    if (!taskId || !name || !Number.isFinite(requestedDateMs)) continue;
    out.push({ taskId, name, requestedDateMs });
  }
  return out;
}

function deepEqualEvents(a: SalaryEvent[], b: SalaryEvent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i];
    const eb = b[i];
    if (ea.taskId !== eb.taskId) return false;
    if (ea.name !== eb.name) return false;
    if (ea.requestedDateMs !== eb.requestedDateMs) return false;
  }
  return true;
}

export const salarySave = onRequest(
  {
    region: 'me-west1',
    concurrency: 20,
    timeoutSeconds: 30,
    // Included for parity with salaries endpoint; also allows reusing same deploy secrets set.
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

      const body = readJsonBody(req) as SavePayload;

      if (!isValidMonthKey(body?.month)) {
        throw new HttpError(400, 'Invalid month. Expected YYYY-MM', 'invalid_month');
      }
      const month = body.month.trim();

      const staffTaskId = String(body?.staffTaskId ?? '').trim();
      if (!staffTaskId) throw new HttpError(400, 'Missing staffTaskId', 'missing_staffTaskId');

      const baseRate = toIntNonNeg(body?.baseRate, 'baseRate');
      const videosCount = toIntNonNeg(body?.videosCount, 'videosCount');
      const bonus = toNumNonNeg(body?.bonus, 'bonus');

      const status: 'unpaid' | 'partial' | 'paid' = body?.status === 'paid' || body?.status === 'partial' ? body.status : 'unpaid';

      const events = normalizeEvents(body?.events);
      // Keep deterministic order for change detection
      events.sort((a, b) => a.requestedDateMs - b.requestedDateMs || a.taskId.localeCompare(b.taskId));

      const eventCount = events.length;
      const eventsTotal = eventCount * baseRate;
      const videosTotal = videosCount * 50;
      const total = eventsTotal + videosTotal + bonus;

      const db = getDb();
      const empRef = db.collection('employees').doc(staffTaskId);
      const payRef = empRef.collection('payments').doc(toPaymentDocId(month));

      const [empSnap, paySnap] = await Promise.all([empRef.get(), payRef.get()]);
      const emp = empSnap.exists ? empSnap.data() : null;
      const pay = paySnap.exists ? paySnap.data() : null;

      const employeeUpdateNeeded = Math.trunc(Number(emp?.baseRate ?? NaN)) !== baseRate;

      const prev = {
        baseRate: Math.trunc(Number(pay?.baseRate ?? NaN)),
        videosCount: Math.trunc(Number(pay?.videosCount ?? NaN)),
        bonus: Number(pay?.bonus ?? NaN),
        status: pay?.status,
        events: Array.isArray(pay?.events) ? (pay.events as any[]) : [],
      };

      const prevEvents = normalizeEvents(prev.events);
      prevEvents.sort((a, b) => a.requestedDateMs - b.requestedDateMs || a.taskId.localeCompare(b.taskId));

      const paymentUpdateNeeded =
        prev.baseRate !== baseRate ||
        prev.videosCount !== videosCount ||
        !(Number.isFinite(prev.bonus) && prev.bonus === bonus) ||
        (prev.status !== status) ||
        !deepEqualEvents(prevEvents, events);

      if (!employeeUpdateNeeded && !paymentUpdateNeeded) {
        sendJson(res, 200, { ok: true, changed: false });
        return;
      }

      const batch = db.batch();

      if (employeeUpdateNeeded) {
        batch.set(empRef, { baseRate }, { merge: true });
      }

      if (paymentUpdateNeeded) {
        batch.set(
          payRef,
          {
            month,
            baseRate,
            videosCount,
            bonus,
            status,
            eventCount,
            eventsTotal,
            videosTotal,
            total,
            events,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      await batch.commit();

      sendJson(res, 200, { ok: true, changed: true });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }

      const err = e as any;
      console.error('salarySave failed', {
        message: String(err?.message ?? 'salarySave failed'),
        name: String(err?.name ?? ''),
        stack: typeof err?.stack === 'string' ? err.stack : undefined,
      });
      sendJson(res, 500, { error: { message: String(err?.message ?? 'salarySave failed') } });
    }
  },
);
