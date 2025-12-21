import type { Request } from 'express';
import { admin, getAdminApp, getDb } from './firebaseAdmin';
import { HttpError } from './errors';

export interface AuthedCaller {
  uid: string;
  email: string;
}

function isFunctionsEmulator(): boolean {
  const raw = process.env.FUNCTIONS_EMULATOR;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return true;
}

function readDevEmail(req: Request): string | null {
  const h = req.header('x-dev-email');
  if (!h) return null;
  const email = h.trim();
  return email ? email : null;
}

function readBearerToken(req: Request): string | null {
  const h = req.header('authorization');
  if (!h) return null;

  // Robust Bearer parsing: trim + case-insensitive regex.
  // Accepts: "Bearer <token>" or "bearer   <token>".
  const m = /^\s*bearer\s+(.+?)\s*$/i.exec(h);
  if (!m) return null;
  const token = m[1].trim();
  return token ? token : null;
}

export async function requireAllowlistedCaller(req: Request): Promise<AuthedCaller> {
  let uid: string | null = null;
  let email: string | null = null;

  if (isFunctionsEmulator()) {
    const devEmail = readDevEmail(req);
    if (devEmail) {
      email = devEmail;
      uid = `dev:${devEmail.toLowerCase()}`;
    }
  }

  if (!email) {
    const token = readBearerToken(req);
    if (!token) throw new HttpError(401, 'Missing Authorization Bearer token', 'auth_required');

    let decoded: admin.auth.DecodedIdToken;
    try {
      // Ensure the default Firebase Admin app exists before using admin.auth().
      getAdminApp();
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      throw new HttpError(401, 'Invalid or expired ID token', 'invalid_token');
    }

    email = decoded.email ?? null;
    if (!email) throw new HttpError(403, 'Missing email on auth token', 'email_required');
    uid = decoded.uid;
  }

  if (!uid || !email) {
    throw new HttpError(500, 'Failed to resolve caller identity', 'auth_internal');
  }

  const allowlistSnap = await getDb().doc('access/allowlist').get();
  const emails = (allowlistSnap.data()?.emails ?? []) as unknown;

  if (!Array.isArray(emails)) {
    throw new HttpError(500, 'Allowlist doc has invalid shape (emails must be an array)', 'allowlist_invalid');
  }

  const ok = emails.some((e) => typeof e === 'string' && e.toLowerCase() === email.toLowerCase());
  if (!ok) throw new HttpError(403, 'Not allowlisted', 'not_allowlisted');

  return { uid, email };
}
