import cors from 'cors';
import type { CorsOptions } from 'cors';
import type { Request, Response } from 'express';

const DEV_ALLOWED_ORIGINS = new Set<string>(['http://localhost:5173']);

// Placeholder for Electron production origin (set when you know it).
// Examples: app://-  OR  https://your-hosted-domain.example
const ELECTRON_PROD_ORIGIN = process.env.ELECTRON_PROD_ORIGIN;

// Electron builds that load via file:// commonly send Origin: "null".
// Keep this OFF by default; enable only if you intentionally want to allow it.
const ALLOW_ELECTRON_NULL_ORIGIN = process.env.ALLOW_ELECTRON_NULL_ORIGIN === 'true';

export function createCorsMiddlewareForRefresh() {
  const options: CorsOptions = {
    origin: (origin, callback) => {
      // origin can be:
      // - string (typical browser)
      // - undefined (non-browser / missing Origin header)
      // - "null" (opaque origin, e.g. file:// in Chromium)
      if (origin == null) return callback(null, true);

      if (DEV_ALLOWED_ORIGINS.has(origin)) return callback(null, true);

      if (ELECTRON_PROD_ORIGIN && origin === ELECTRON_PROD_ORIGIN) return callback(null, true);

      if (ALLOW_ELECTRON_NULL_ORIGIN && origin === 'null') return callback(null, true);

      return callback(null, false);
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-dev-email'],
    optionsSuccessStatus: 204,
    maxAge: 3600,

    // We'll explicitly short-circuit OPTIONS after CORS runs.
    preflightContinue: true,
  };

  return cors(options);
}

export function runCors(req: Request, res: Response, middleware: ReturnType<typeof cors>): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
