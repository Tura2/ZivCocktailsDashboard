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

export async function getClosedWonMoveTimestampMs(client: ClickUpClient, taskId: string): Promise<number | null> {
  const comments = await client.getTaskComments(taskId);
  return extractClosedWonMoveTimestampMs(comments);
}
