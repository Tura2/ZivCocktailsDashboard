import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';

import { createCorsMiddlewareForRefresh, runCors } from './middleware/cors';
import { CLICKUP_API_TOKEN, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_IG_USER_ID } from './config/secrets';
import { refreshHandler } from './refresh/refreshHandler';

const corsMiddleware = createCorsMiddlewareForRefresh();

export const refresh = onRequest(
  {
    region: 'me-west1',
    concurrency: 80,
    secrets: [CLICKUP_API_TOKEN, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_IG_USER_ID],
  },
  async (req: Request, res: Response) => {
    // 1) CORS must run before any auth / business logic
    await runCors(req, res, corsMiddleware);

    // 2) Preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // 3) Method guard
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).json({ error: { message: 'Method not allowed' } });
      return;
    }

    // 4) Existing business logic (auth + compute + Firestore writes)
    await refreshHandler(req, res);
  }
);