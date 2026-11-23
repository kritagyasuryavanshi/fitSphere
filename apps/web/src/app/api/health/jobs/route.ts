import { connection } from 'next/server';
import { overdueJobs } from '@/lib/jobs';
import { authorised } from '@/lib/video-check';

// M6-12: the daily check in the private fitsphere-ops repo calls this with the cron secret. It fails, and GitHub emails
// the owner, when a job failed or has not succeeded for 26 hours. Only {ok} goes out; details stay in job_runs.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  const overdue = await overdueJobs();
  const ok = overdue !== null && overdue.length === 0;
  return Response.json({ ok }, { status: ok ? 200 : 503 });
}
