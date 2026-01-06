import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN } from './config/secrets';
import { readJsonBody, sendJson, methodNotAllowed } from './sync/http';
import { getDb, admin } from './refresh/firebaseAdmin';

const corsMiddleware = createCorsMiddlewareForRefresh();

type PayPayload = {
  staffTaskId: string;
  amount: number;
};

function toNumPos(v: unknown, label: string): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${label}`, `invalid_${label}`);
  if (n <= 0) throw new HttpError(400, `${label} must be > 0`, `invalid_${label}`);
  return n;
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const salaryPay = onRequest(
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
      const caller = await requireAllowlistedCaller(req);
      const body = readJsonBody(req) as PayPayload;

      const staffTaskId = String(body?.staffTaskId ?? '').trim();
      if (!staffTaskId) throw new HttpError(400, 'Missing staffTaskId', 'missing_staffTaskId');

      const amount = toNumPos(body?.amount, 'amount');

      const db = getDb();
      const empRef = db.collection('employees').doc(staffTaskId);
      const txRef = empRef.collection('payments').doc();

      const result = await db.runTransaction(async (tx) => {
        const empSnap = await tx.get(empRef);
        const emp = empSnap.exists ? empSnap.data() : null;

        const currentBalance = safeNumber(emp?.currentBalance, 0);
        if (amount > currentBalance) {
          throw new HttpError(400, 'Amount exceeds current balance', 'amount_exceeds_balance');
        }

        const nextBalance = currentBalance - amount;

        tx.set(empRef, { currentBalance: nextBalance }, { merge: true });

        tx.set(txRef, {
          type: 'payment',
          amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdByEmail: caller.email,
          balanceAfter: nextBalance,
        });

        return { currentBalance: nextBalance, transactionId: txRef.id };
      });

      sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }

      const err = e as any;
      console.error('salaryPay failed', {
        message: String(err?.message ?? 'salaryPay failed'),
        name: String(err?.name ?? ''),
        stack: typeof err?.stack === 'string' ? err.stack : undefined,
      });
      sendJson(res, 500, { error: { message: String(err?.message ?? 'salaryPay failed') } });
    }
  },
);
