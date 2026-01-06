import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN } from './config/secrets';
import { readJsonBody, sendJson, methodNotAllowed } from './sync/http';
import { getDb } from './refresh/firebaseAdmin';

const corsMiddleware = createCorsMiddlewareForRefresh();

type HistoryPayload = {
  staffTaskId: string;
  limit?: number;
};

function toIntInRange(v: unknown, label: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${label}`, `invalid_${label}`);
  const i = Math.trunc(n);
  if (i < min || i > max) throw new HttpError(400, `${label} must be between ${min} and ${max}`, `invalid_${label}`);
  return i;
}

export const salaryHistory = onRequest(
  {
    region: 'me-west1',
    concurrency: 20,
    timeoutSeconds: 30,
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
      const body = readJsonBody(req) as HistoryPayload;

      const staffTaskId = String(body?.staffTaskId ?? '').trim();
      if (!staffTaskId) throw new HttpError(400, 'Missing staffTaskId', 'missing_staffTaskId');

      const limit = body?.limit == null ? 20 : toIntInRange(body.limit, 'limit', 1, 100);

      const db = getDb();
      const empRef = db.collection('employees').doc(staffTaskId);
      const q = empRef
        .collection('payments')
        .where('type', '==', 'payment')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      const snap = await q.get();

      const items = snap.docs.map((d) => {
        const data = d.data() as any;
        const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
        return {
          id: d.id,
          createdAt,
          amount: Number(data?.amount ?? 0),
          balanceAfter: Number(data?.balanceAfter ?? 0),
        };
      });

      sendJson(res, 200, { ok: true, items });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }

      const err = e as any;
      console.error('salaryHistory failed', {
        message: String(err?.message ?? 'salaryHistory failed'),
        name: String(err?.name ?? ''),
        stack: typeof err?.stack === 'string' ? err.stack : undefined,
      });
      sendJson(res, 500, { error: { message: String(err?.message ?? 'salaryHistory failed') } });
    }
  },
);
