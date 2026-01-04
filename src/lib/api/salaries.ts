import { auth, firebaseApp, firebaseEnabled } from '@/lib/firebase';

export type SalariesRow = {
  staffTaskId: string;
  name: string;
  phone: string | null;
  eventCount: number;
};

export type SalariesResponse = {
  ok: true;
  month: string;
  timezone: string;
  rows: SalariesRow[];
};

export type SalariesResult =
  | SalariesResponse
  | { ok: false; status: number; message: string; code?: string };

function normalizeUrl(explicit: string | undefined): string | null {
  if (!explicit) return null;
  const trimmed = explicit.trim();
  if (!trimmed) return null;
  // Collapse repeated slashes after the scheme (keep "https://").
  const collapsed = trimmed.replace(/^(https?:\/\/)(.*)$/i, (_, scheme: string, rest: string) => {
    return scheme + rest.replace(/\/+?/g, '/');
  });
  return collapsed.replace(/\/+$/g, '');
}

function getSalariesUrl(): string | null {
  return normalizeUrl(import.meta.env.VITE_SALARIES_URL as string | undefined);
}

async function postSalaries(url: string, token: string, month: string): Promise<{ response: Response; payload: any }> {
  const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined)?.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (devEmail) headers['x-dev-email'] = devEmail;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ month }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({} as any)) : ({} as any);

  if (!isJson) {
    const text = await response.text().catch(() => '');
    (payload as any).__nonJson = {
      contentType,
      snippet: text ? text.slice(0, 200) : '',
    };
  }

  return { response, payload };
}

export async function fetchSalaries(month: string): Promise<SalariesResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getSalariesUrl();
  if (!url) {
    return { ok: false, status: 0, message: 'Salaries endpoint is not configured (missing VITE_SALARIES_URL)' };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  const token1 = await currentUser.getIdToken();
  let { response, payload } = await postSalaries(url, token1, month);

  if (!response.ok && response.status === 401 && payload?.error?.code === 'invalid_token') {
    if (import.meta.env.DEV) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        // Intentionally do not log the token itself.
        console.warn('[salaries] invalid_token (first attempt)', {
          salariesUrl: url,
          firebaseProjectId: firebaseApp?.options?.projectId,
          aud: (tokenResult?.claims as any)?.aud,
          iss: (tokenResult?.claims as any)?.iss,
          exp: (tokenResult?.claims as any)?.exp,
          iat: (tokenResult?.claims as any)?.iat,
        });
      } catch {
        // ignore
      }
    }

    const token2 = await currentUser.getIdToken(true);
    ({ response, payload } = await postSalaries(url, token2, month));
  }

  if (!response.ok) {
    if (payload?.__nonJson) {
      return {
        ok: false,
        status: response.status,
        message: `Salaries failed with non-JSON response (${response.status}). Possible infra/IAM/auth proxy mismatch.`,
        code: 'non_json_response',
      };
    }

    return {
      ok: false,
      status: response.status,
      message: payload?.error?.message || `Salaries failed (${response.status})`,
      code: payload?.error?.code,
    };
  }

  return {
    ok: true,
    month: payload?.month,
    timezone: payload?.timezone ?? 'Asia/Jerusalem',
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
  };
}
