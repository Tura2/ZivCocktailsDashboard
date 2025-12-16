import { runRefresh } from './runRefresh';
import { newJobId, createJob, appendJobLog, markJobError, markJobSuccess } from './jobs';

async function main(): Promise<void> {
  const jobId = newJobId();
  const email = process.env.REQUESTED_BY_EMAIL;
  if (!email) throw new Error('Missing env var REQUESTED_BY_EMAIL');

  await createJob(jobId, email, '(resolving)');

  try {
    const result = await runRefresh({
      jobId,
      requestedByEmail: email,
      targetMonthInput: process.env.TARGET_MONTH,
      log: (m) => appendJobLog(jobId, m),
    });

    await markJobSuccess(jobId, result.writtenSnapshots, result.skippedSnapshots);
    process.stdout.write(JSON.stringify({ jobId, ...result }, null, 2) + '\n');
  } catch (e) {
    const err = e as Error;
    await markJobError(jobId, err.message);
    throw err;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
