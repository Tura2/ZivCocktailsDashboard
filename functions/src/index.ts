import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { refreshHandler } from './refresh/refreshHandler';

setGlobalOptions({ region: 'me-west1', concurrency: 80 });

export const refresh = onRequest(async (req, res) => {
  // Minimal CORS for local/dev; tighten later if needed.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-dev-email');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  await refreshHandler(req, res);
});
