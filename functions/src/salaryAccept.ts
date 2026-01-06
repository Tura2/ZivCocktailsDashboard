import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN } from './config/secrets';
import { readJsonBody, sendJson, methodNotAllowed } from './sync/http';
import { getDb } from './refresh/firebaseAdmin';

const corsMiddleware = createCorsMiddlewareForRefresh();

type SalaryEvent = { taskId: string; name: string; requestedDateMs: number; recommendation?: boolean | null };

type AcceptPayload = {
  month: string; // YYYY-MM
  staffTaskId: string;
  baseRate: number;
  videosCount: number;
  videoRate: number;
  bonus: number;
  // Optional; if provided, it will be stored into the monthly snapshot for audit.
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

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEvents(raw: unknown): SalaryEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: SalaryEvent[] = [];
  for (const e of arr) {
    const taskId = String((e as any)?.taskId ?? '').trim();
    const name = String((e as any)?.name ?? '').trim();
    const requestedDateMs = Math.trunc(Number((e as any)?.requestedDateMs ?? NaN));
    const recommendationRaw = (e as any)?.recommendation;
    const recommendation = recommendationRaw === true ? true : recommendationRaw === false ? false : null;

    if (!taskId || !name || !Number.isFinite(requestedDateMs)) continue;
    out.push({ taskId, name, requestedDateMs, recommendation });
  }

  out.sort((a, b) => a.requestedDateMs - b.requestedDateMs || a.taskId.localeCompare(b.taskId));
  return out;
}

export const salaryAccept = onRequest(
  {
    region: 'me-west1',
    concurrency: 20,
    timeoutSeconds: 30,
    // Keep for parity with other endpoints; also allows reuse of deploy secrets set.
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
      const caller = await requireAllowlistedCaller(req);
      const body = readJsonBody(req) as AcceptPayload;

      if (!isValidMonthKey(body?.month)) {
        throw new HttpError(400, 'Invalid month. Expected YYYY-MM', 'invalid_month');
      }
      const month = body.month.trim();

      const staffTaskId = String(body?.staffTaskId ?? '').trim();
      if (!staffTaskId) throw new HttpError(400, 'Missing staffTaskId', 'missing_staffTaskId');

      const baseRate = toIntNonNeg(body?.baseRate, 'baseRate');
      const videosCount = toIntNonNeg(body?.videosCount, 'videosCount');
      const videoRate = toIntNonNeg(body?.videoRate, 'videoRate');
      const bonus = toNumNonNeg(body?.bonus, 'bonus');
      const events = normalizeEvents(body?.events);

      const eventCount = events.length;
      const eventsTotal = eventCount * baseRate;
      const videosTotal = videosCount * videoRate;
      const total = eventsTotal + videosTotal + bonus;

      if (!(total > 0)) {
        throw new HttpError(400, 'Nothing to accrue for this employee/month', 'nothing_to_accrue');
      }

      const db = getDb();
      const empRef = db.collection('employees').doc(staffTaskId);
      const payRef = empRef.collection('payments').doc(toPaymentDocId(month));

      const result = await db.runTransaction(async (tx) => {
        const [empSnap, paySnap] = await Promise.all([tx.get(empRef), tx.get(payRef)]);
        const emp = empSnap.exists ? empSnap.data() : null;
        const pay = paySnap.exists ? paySnap.data() : null;

        const alreadyProcessed = Boolean(pay?.processedAt);
        const currentBalance = safeNumber(emp?.currentBalance, 0);

        if (alreadyProcessed) {
          return { alreadyProcessed: true, currentBalance };
        }

        const nextBalance = currentBalance + total;
        const nowIso = new Date().toISOString();

        tx.set(empRef, { currentBalance: nextBalance }, { merge: true });

        tx.set(
          payRef,
          {
            month,
            baseRate,
            videosCount,
            videoRate,
            bonus,
            eventCount,
            eventsTotal,
            videosTotal,
            total,
            events,
            status: pay?.status === 'paid' || pay?.status === 'partial' ? pay.status : 'unpaid',
            updatedAt: nowIso,

            processedAt: nowIso,
            processedAmount: total,
            processedByEmail: caller.email,
            balanceAfterAccrual: nextBalance,
          },
          { merge: true },
        );

        return { alreadyProcessed: false, currentBalance: nextBalance };
      });

      sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }

      const err = e as any;
      console.error('salaryAccept failed', {
        message: String(err?.message ?? 'salaryAccept failed'),
        name: String(err?.name ?? ''),
        stack: typeof err?.stack === 'string' ? err.stack : undefined,
      });
      sendJson(res, 500, { error: { message: String(err?.message ?? 'salaryAccept failed') } });
    }
  },
);
