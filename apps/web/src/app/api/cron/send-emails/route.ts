import { connection } from 'next/server';
import { queueSessionReminders, sendQueuedEmails } from '@/lib/email-send';
import { authorised } from '@/lib/video-check';

// Once a day (vercel.json), 08:30 India time: queues today's session reminders, then sends what waits. Feedback
// also sends at once from its action, so this mostly delivers the reminders and retries what failed.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  // A failing reminder step must not stop the rest of the day's email.
  const reminded = await queueSessionReminders().catch((e) => {
    console.error('queueing session reminders failed', e);
    return null;
  });
  const result = await sendQueuedEmails();
  return result ? Response.json({ reminded, ...result }) : Response.json({ reminded, skipped: 'email is not configured: RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SITE_URL or SUPABASE_SECRET_KEY is missing' });
}
