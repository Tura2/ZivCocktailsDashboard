import type { Request, Response } from 'express';
import { requireAllowlistedCaller } from './authz';
import { AlreadyRunningError, HttpError } from './errors';
import { newJobId, createJob, appendJobLog, markJobError, markJobSuccess } from './jobs';
import { acquireRefreshLock, releaseRefreshLock } from './lock';
import { runRefresh } from './runRefresh';

function readJsonBody(req: Request): any {
  const body = req.body;
  if (body == null) return {};
  if (typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'bad_json');
    }
  }
  return {};
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  let caller: { email: string; uid: string };
  try {
    caller = await requireAllowlistedCaller(req);
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: { message: e.message, code: e.code } });
      return;
    }
    throw e;
  }

  const jobId = newJobId();

  try {
    await acquireRefreshLock(jobId);
  } catch (e) {
    if (e instanceof AlreadyRunningError) {
      // Important: no job doc and no writes for the losing caller.
      res.status(409).json({
        status: 'already_running',
        jobId: e.runningJobId,
        error: { message: e.message, code: e.code },
      });
      return;
    }
    throw e;
  }

  const body = readJsonBody(req);
  try {
    await createJob(jobId, caller.email, '(resolving)');

    const result = await runRefresh({
      jobId,
      requestedByEmail: caller.email,
      targetMonthInput: body?.targetMonth,
      log: (m) => appendJobLog(jobId, m),
    });

    await markJobSuccess(jobId, result.writtenSnapshots, result.skippedSnapshots);

    res.status(200).json({
      jobId,
      status: 'success',
      targetMonth: result.targetMonth,
      writtenSnapshots: result.writtenSnapshots,
      skippedSnapshots: result.skippedSnapshots,
    });
  } catch (e) {
    const err = e as Error;
    await markJobError(jobId, err.message, (e as any)?.code);

    if (e instanceof HttpError) {
      res.status(e.status).json({ error: { message: e.message, code: e.code } });
      return;
    }

    res.status(500).json({ error: { message: err.message } });
  } finally {
    await releaseRefreshLock(jobId);
  }
}
