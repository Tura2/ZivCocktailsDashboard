import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { requireAllowlistedCaller } from './refresh/authz';
import { HttpError } from './refresh/errors';
import { CLICKUP_API_TOKEN, ICOUNT_TOKEN } from './config/secrets';
import { sendJson, methodNotAllowed } from './sync/http';
import { runExpensesSync } from './sync/expenses';

const corsMiddleware = createCorsMiddlewareForRefresh();

export const syncExpenses = onRequest(
  {
    region: 'me-west1',
    concurrency: 5,
    timeoutSeconds: 540,
    secrets: [CLICKUP_API_TOKEN, ICOUNT_TOKEN],
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
      const result = await runExpensesSync();
      sendJson(res, 200, { status: 'success', caller: { email: caller.email }, result });
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { message: e.message, code: e.code } });
        return;
      }
      const err = e as any;
      sendJson(res, 500, { error: { message: String(err?.message ?? 'Expenses sync failed') } });
    }
  },
);
