import { connection } from 'next/server';
import { queueSessionReminders, sendQueuedEmails, sweepEngagements } from '@/lib/email-send';
import { stopSubscriptions } from '@/lib/payments/reconcile';
import { sendPendingRefunds } from '@/lib/payments/refunds';
import { pruneEmailOutbox, pruneStories, recordJob } from '@/lib/jobs';
import { authorised } from '@/lib/video-check';

// Once a day (vercel.json), 08:30 India time: ends paid coaching that ran out and stops its subscriptions (M4-11), sends refunds (M4-12), queues today's session
// reminders, then sends what waits. Feedback also sends at once from its action, so this mostly delivers the
// reminders and coaching emails, and retries what failed. One cron for all of it: the Vercel plan limits crons.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  // A failing step must not stop the rest of the day's email. Each failure is recorded for the alert (M6-12).
  const failed: string[] = [];
  const swept = await sweepEngagements().catch((e) => {
    console.error('sweeping engagements failed', e);
    failed.push('sweeping engagements');
    return null;
  });
  // Money owed back is refunded, and refunds that did not reach the provider are sent again (M4-12). Before stopping
  // subscriptions, so coaching refunded here has its subscription stopped in the same run.
  const refunded = await sendPendingRefunds().catch((e) => {
    console.error('sending refunds failed', e);
    failed.push('sending refunds');
    return null;
  });
  const stopped = await stopSubscriptions().catch((e) => {
    console.error('stopping subscriptions failed', e);
    failed.push('stopping subscriptions');
    return null;
  });
  const reminded = await queueSessionReminders().catch((e) => {
    console.error('queueing session reminders failed', e);
    failed.push('queueing session reminders');
    return null;
  });
  const pruned = await pruneEmailOutbox().catch((e) => {
    console.error('pruning the email outbox failed', e);
    failed.push('pruning the email outbox');
    return null;
  });
  const stories = await pruneStories().catch((e) => {
    console.error('pruning client stories failed', e);
    failed.push('pruning client stories');
    return null;
  });
  const result = await sendQueuedEmails().catch((e) => {
    console.error('sending emails failed', e);
    failed.push('sending emails');
    return null;
  });
  await recordJob('send-emails', failed);
  if (failed.includes('sending emails')) return Response.json({ swept, stopped, refunded, reminded, pruned, stories, failed }, { status: 500 });
  return result ? Response.json({ swept, stopped, refunded, reminded, pruned, stories, ...result }) : Response.json({ swept, stopped, refunded, reminded, pruned, stories, skipped: 'email is not configured: RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SITE_URL or SUPABASE_SECRET_KEY is missing' });
}
