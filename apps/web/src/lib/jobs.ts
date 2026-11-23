import { createDbClient } from '@fitsphere/db';

// M6-12: the daily jobs record how they ended, and the health check reads it for the failure alert.
type Job = 'send-emails' | 'check-videos';

function service() {
  return process.env.SUPABASE_SECRET_KEY ? createDbClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SECRET_KEY) : null;
}

/** Records a run. A failure to record is logged, never thrown: the job's own work matters more. */
export async function recordJob(job: Job, failed: string[]) {
  const { error } = (await service()?.rpc('record_job', { job_name: job, ok: failed.length === 0, error: failed.join('; ') })) ?? {};
  if (error) console.error('recording the job run failed', job, error);
}

/** Deletes email rows older than 90 days, as the privacy notice says. */
export async function pruneEmailOutbox() {
  const db = service();
  if (!db) return null;
  const { data, error } = await db.rpc('prune_email_outbox');
  if (error) throw error;
  return data;
}

/** The jobs that failed or have not run for over a day. Null when the database cannot be asked. */
export async function overdueJobs(): Promise<string[] | null> {
  const db = service();
  if (!db) return null;
  const { data, error } = await db.rpc('jobs_overdue');
  if (error) return null;
  return data.map((r) => r.job);
}

/** M4-15: drops withdrawn and stale client stories, then their photos no revision still uses. */
export async function pruneStories() {
  const db = service();
  if (!db) return null;
  const { data, error } = await db.rpc('prune_stories');
  if (error) throw error;
  const keys = data.map((r) => r.photo_key);
  if (keys.length) {
    const removed = await db.storage.from('story-photos').remove(keys);
    if (removed.error) throw removed.error;
  }
  return keys.length;
}
