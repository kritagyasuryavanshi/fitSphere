import { connection } from 'next/server';
import { queueSessionReminders, sendQueuedEmails, sweepEngagements } from '@/lib/email-send';
import { stopSubscriptions } from '@/lib/payments/reconcile';
import { sendPendingRefunds } from '@/lib/payments/refunds';
import { authorised } from '@/lib/video-check';

// Once a day (vercel.json), 08:30 India time: ends paid coaching that ran out and stops its subscriptions (M4-11), sends refunds (M4-12), queues today's session
// reminders, then sends what waits. Feedback also sends at once from its action, so this mostly delivers the
// reminders and coaching emails, and retries what failed. One cron for all of it: the Vercel plan limits crons.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  // A failing step must not stop the rest of the day's email.
  const swept = await sweepEngagements().catch((e) => {
    console.error('sweeping engagements failed', e);
    return null;
  });
  // Money owed back is refunded, and refunds that did not reach the provider are sent again (M4-12). Before stopping
  // subscriptions, so coaching refunded here has its subscription stopped in the same run.
  const refunded = await sendPendingRefunds().catch((e) => {
    console.error('sending refunds failed', e);
    return null;
  });
  const stopped = await stopSubscriptions().catch((e) => {
    console.error('stopping subscriptions failed', e);
    return null;
  });
  const reminded = await queueSessionReminders().catch((e) => {
    console.error('queueing session reminders failed', e);
    return null;
  });
  const result = await sendQueuedEmails();
  return result ? Response.json({ swept, stopped, refunded, reminded, ...result }) : Response.json({ swept, stopped, refunded, reminded, skipped: 'email is not configured: RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SITE_URL or SUPABASE_SECRET_KEY is missing' });
}
