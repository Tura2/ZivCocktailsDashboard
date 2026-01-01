import type { ClickUpClient } from './ClickUpClient';
import type { ClickUpTaskComment } from './types';

function parseMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function textIncludes(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function isClickBot(comment: ClickUpTaskComment): boolean {
  const id = comment.user?.id;
  const username = comment.user?.username ?? '';
  return id === -1 || username.toLowerCase() === 'clickbot';
}

function ciEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

function matchesDepositPaidTrigger(text: string): boolean {
  // Hebrew examples:
  // - "מקדמה שולמה"
  // - "שולמה מקדמה בסך :ILS 20"
  // English fallbacks:
  // - "deposit paid" / "advance paid"
  const hebrew = /מקדמ/.test(text) && /שולמ/.test(text);
  const lower = text.toLowerCase();
  const english = (lower.includes('deposit') || lower.includes('advance')) && (lower.includes('paid') || lower.includes('received'));
  return hebrew || english;
}

function matchesStatusChangedToDoneTrigger(text: string): boolean {
  // ClickBot automation example:
  // "Status has changed to : DONE"
  const lower = text.toLowerCase();
  if (lower.includes('status has changed') && lower.includes('done')) return true;
  // Tolerate minor formatting differences
  if (lower.includes('status') && lower.includes('changed') && lower.includes('done')) return true;
  return false;
}

function parseStatusChangedTo(text: string): string | null {
  // ClickBot automation example:
  // "Status has changed to : DONE"
  const m = /status\s+has\s+changed\s+to\s*:\s*([^\n\r]+)/i.exec(text);
  if (!m) return null;
  const v = (m[1] ?? '').trim();
  return v ? v : null;
}

export function extractClosedWonMoveTimestampMs(comments: ReadonlyArray<ClickUpTaskComment>): number | null {
  let best: number | null = null;

  for (const c of comments) {
    if (!isClickBot(c)) continue;
    const text = c.comment_text ?? '';
    if (!textIncludes(text, 'Moved to Event Calendar')) continue;
    if (!textIncludes(text, 'Closed Won')) continue;

    const ms = parseMs(c.date);
    if (ms == null) continue;
    if (best == null || ms > best) best = ms;
  }

  return best;
}

// Earliest deposit-paid comment timestamp for a task.
// We purposely use the first matching comment to avoid double-counting if multiple similar comments exist.
export function extractDepositPaidTimestampMs(comments: ReadonlyArray<ClickUpTaskComment>): number | null {
  let best: number | null = null;

  for (const c of comments) {
    const text = c.comment_text ?? '';
    if (!matchesDepositPaidTrigger(text)) continue;

    const ms = parseMs(c.date);
    if (ms == null) continue;
    if (best == null || ms < best) best = ms;
  }

  return best;
}

// Earliest timestamp when status changed to DONE (to avoid double counting if reverted and DONE again).
export function extractFirstDoneStatusChangeTimestampMs(comments: ReadonlyArray<ClickUpTaskComment>): number | null {
  let best: number | null = null;

  for (const c of comments) {
    if (!isClickBot(c)) continue;
    const text = c.comment_text ?? '';
    if (!matchesStatusChangedToDoneTrigger(text)) continue;

    const ms = parseMs(c.date);
    if (ms == null) continue;
    if (best == null || ms < best) best = ms;
  }

  return best;
}

export function extractFirstStatusChangeTimestampMs(comments: ReadonlyArray<ClickUpTaskComment>, toStatus: string): number | null {
  let best: number | null = null;

  for (const c of comments) {
    if (!isClickBot(c)) continue;
    const text = c.comment_text ?? '';
    const parsed = parseStatusChangedTo(text);
    if (!ciEquals(parsed, toStatus)) continue;

    const ms = parseMs(c.date);
    if (ms == null) continue;
    if (best == null || ms < best) best = ms;
  }

  return best;
}

// Earliest timestamp where we observe a Billing -> Done transition.
// Uses ClickBot "Status has changed to" comments as the task history source.
export function extractFirstBillingToDoneTransitionTimestampMs(comments: ReadonlyArray<ClickUpTaskComment>): number | null {
  const events: Array<{ ms: number; to: string }> = [];

  for (const c of comments) {
    if (!isClickBot(c)) continue;
    const text = c.comment_text ?? '';
    const to = parseStatusChangedTo(text);
    const ms = parseMs(c.date);
    if (!to || ms == null) continue;
    events.push({ ms, to });
  }

  events.sort((a, b) => a.ms - b.ms);

  let sawBilling = false;
  for (const e of events) {
    if (ciEquals(e.to, 'billing')) {
      sawBilling = true;
      continue;
    }
    if (sawBilling && ciEquals(e.to, 'done')) {
      return e.ms;
    }
  }

  return null;
}

export async function getDepositPaidTimestampMs(client: ClickUpClient, taskId: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractDepositPaidTimestampMs(comments);
}

export async function getFirstDoneStatusChangeTimestampMs(client: ClickUpClient, taskId: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractFirstDoneStatusChangeTimestampMs(comments);
}

export async function getFirstStatusChangeTimestampMs(client: ClickUpClient, taskId: string, toStatus: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractFirstStatusChangeTimestampMs(comments, toStatus);
}

export async function getFirstBillingToDoneTransitionTimestampMs(client: ClickUpClient, taskId: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractFirstBillingToDoneTransitionTimestampMs(comments);
}

export async function getClosedWonMoveTimestampMs(client: ClickUpClient, taskId: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractClosedWonMoveTimestampMs(comments);
}
