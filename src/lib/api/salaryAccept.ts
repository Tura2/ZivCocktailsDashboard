import { auth, firebaseApp, firebaseEnabled } from '@/lib/firebase';
import type { SalaryEvent } from '@/lib/api/salaries';

export type SalaryAcceptPayload = {
  month: string; // YYYY-MM
  staffTaskId: string;
  baseRate: number;
  videosCount: number;
  videoRate: number;
  bonus: number;
  events?: SalaryEvent[];
};

export type SalaryAcceptResult =
  | { ok: true; alreadyProcessed: boolean; currentBalance: number }
  | { ok: false; status: number; message: string; code?: string };

function normalizeUrl(explicit: string | undefined): string | null {
  if (!explicit) return null;
  const trimmed = explicit.trim();
  if (!trimmed) return null;
  const collapsed = trimmed.replace(/^(https?:\/\/)(.*)$/i, (_, scheme: string, rest: string) => {
    return scheme + rest.replace(/\/+?/g, '/');
  });
  return collapsed.replace(/\/+$/g, '');
}

function getSalaryAcceptUrl(): string | null {
  return normalizeUrl(import.meta.env.VITE_SALARY_ACCEPT_URL as string | undefined);
}

async function post(url: string, token: string, payload: SalaryAcceptPayload): Promise<{ response: Response; payload: any }> {
  const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined)?.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (devEmail) headers['x-dev-email'] = devEmail;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json().catch(() => ({} as any)) : ({} as any);

  if (!isJson) {
    const text = await response.text().catch(() => '');
    (data as any).__nonJson = { contentType, snippet: text ? text.slice(0, 200) : '' };
  }

  return { response, payload: data };
}

export async function acceptSalary(payload: SalaryAcceptPayload): Promise<SalaryAcceptResult> {
  if (!firebaseEnabled) {
    return { ok: false, status: 0, message: 'Firebase is not configured' };
  }

  const url = getSalaryAcceptUrl();
  if (!url) {
    return { ok: false, status: 0, message: 'Salary accept endpoint is not configured (missing VITE_SALARY_ACCEPT_URL)' };
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return { ok: false, status: 401, message: 'Not authenticated' };
  }

  const token1 = await currentUser.getIdToken();
  let { response, payload: resPayload } = await post(url, token1, payload);

  if (!response.ok && response.status === 401 && resPayload?.error?.code === 'invalid_token') {
    if (import.meta.env.DEV) {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        console.warn('[salaryAccept] invalid_token (first attempt)', {
          salaryAcceptUrl: url,
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
    ({ response, payload: resPayload } = await post(url, token2, payload));
  }

  if (!response.ok) {
    if (resPayload?.__nonJson) {
      return {
        ok: false,
        status: response.status,
        message: `Salary accept failed with non-JSON response (${response.status}). Possible infra/IAM/auth proxy mismatch.`,
        code: 'non_json_response',
      };
    }

    return {
      ok: false,
      status: response.status,
      message: resPayload?.error?.message || `Salary accept failed (${response.status})`,
      code: resPayload?.error?.code,
    };
  }

  return {
    ok: true,
    alreadyProcessed: Boolean(resPayload?.alreadyProcessed),
    currentBalance: Number(resPayload?.currentBalance ?? 0),
  };
}
