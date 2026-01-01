import type { Request, Response } from 'express';

export function readJsonBody(req: Request): any {
  const body = req.body;
  if (body == null) return {};
  if (typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

export async function readJson<T = any>(res: globalThis.Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response (status ${res.status}): ${text.slice(0, 500)}`);
  }
}

export function sendJson(res: Response, status: number, payload: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

export function methodNotAllowed(res: Response, allow: string[]): void {
  res.setHeader('Allow', allow.join(', '));
  sendJson(res, 405, { error: { message: 'Method not allowed' } });
}
