import { CLICKUP_API_TOKEN, ICOUNT_TOKEN } from '../config/secrets';
import { readJson } from './http';
import { createHash } from 'node:crypto';

const ICOUNT_API_URL = 'https://api.icount.co.il/api/v3.php';

export const DAYS_BACK = 45;
export const ICOUNT_PAGE_SIZE = 50;
export const CLICKUP_TIMEOUT_MS = 30_000;

export function normalizeText(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function clickupRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  opts: {
    query?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  },
): Promise<T> {
  const token = CLICKUP_API_TOKEN.value();
  if (!token) throw new Error('Missing CLICKUP_API_TOKEN secret');

  const u = new URL(url);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      u.searchParams.set(k, v);
    }
  }

  let lastText: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithTimeout(
      u.toString(),
      {
        method,
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      },
      opts.timeoutMs ?? CLICKUP_TIMEOUT_MS,
    );

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || '0');
      await sleep(Math.max(1000, retryAfter * 1000) + attempt * 500);
      continue;
    }

    if (!res.ok) {
      lastText = await res.text();
      throw new Error(`ClickUp ${method} ${u.pathname} failed: ${res.status} ${res.statusText} :: ${lastText.slice(0, 1000)}`);
    }

    return await readJson<T>(res);
  }

  throw new Error(`ClickUp ${method} ${url} failed due to rate limiting${lastText ? ` :: ${lastText}` : ''}`);
}

export async function icountRequest<T>(module: string, action: string, payload: Record<string, any>): Promise<T> {
  const token = ICOUNT_TOKEN.value()?.trim();
  if (!token) throw new Error('Missing ICOUNT_TOKEN secret');

  // Safe fingerprint so we can verify the deployed secret matches the local token
  // without logging the token itself.
  const tokenFp = createHash('sha256').update(token).digest('hex').slice(0, 10);
  const tokenLen = token.length;

  const url = `${ICOUNT_API_URL}/${module}/${action}`;
  // Match the working Python wrapper: `requests.post(..., json=data)`
  // iCount v3.php accepts module/action in the URL path.
  const body = JSON.stringify(payload ?? {});

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    },
    30_000,
  );

  const data = await readJson<any>(res);

  // iCount sometimes returns {status:false, reason:...} with 200.
  if (data?.status === false) {
    const reason = String(data?.reason ?? 'Unknown');

    const payloadPreviewKeys = [
      'start_date',
      'end_date',
      'start_ts',
      'end_ts',
      'doctype',
      'docnum',
      'status',
      'max_results',
      'limit',
      'offset',
      'page',
      'sort_field',
      'sort_order',
      'detail_level',
    ] as const;
    const payloadPreview: Record<string, unknown> = {};
    for (const k of payloadPreviewKeys) {
      if (k in (payload ?? {})) payloadPreview[k] = (payload as any)[k];
    }

    // Helpful when debugging prod-only: tells us if we are using the expected token
    // and what iCount actually rejected.
    console.error('iCount API returned status=false', {
      module,
      action,
      reason,
      httpStatus: res.status,
      tokenFp,
      tokenLen,
      payload: payloadPreview,
    });
    return data as T;
  }

  if (!res.ok) {
    console.error('iCount API non-OK HTTP response', {
      module,
      action,
      httpStatus: res.status,
      tokenFp,
      tokenLen,
    });
    throw new Error(`iCount ${module}/${action} HTTP ${res.status}: ${JSON.stringify(data).slice(0, 1000)}`);
  }

  return data as T;
}

export function parseDateToTsMs(dateStr: string | null | undefined): number | null {
  const raw = String(dateStr ?? '').trim();
  if (!raw) return null;

  const fmts: Array<(s: string) => Date | null> = [
    (s) => {
      // YYYY-MM-DD
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m) return null;
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      return Number.isNaN(d.getTime()) ? null : d;
    },
    (s) => {
      // DD/MM/YY
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s);
      if (!m) return null;
      const yy = Number(m[3]);
      const year = yy >= 70 ? 1900 + yy : 2000 + yy;
      const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
      return Number.isNaN(d.getTime()) ? null : d;
    },
    (s) => {
      // MM/DD/YY
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s);
      if (!m) return null;
      const yy = Number(m[3]);
      const year = yy >= 70 ? 1900 + yy : 2000 + yy;
      const d = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
      return Number.isNaN(d.getTime()) ? null : d;
    },
  ];

  for (const f of fmts) {
    const d = f(raw);
    if (d) return d.getTime();
  }

  return null;
}

export function safeInt(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function parseAmount(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'object' && v && 'amount' in v) {
    const n = Number((v as any).amount);
    return Number.isFinite(n) ? n : 0;
  }
  const s = String(v).replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
