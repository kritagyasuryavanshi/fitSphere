import { connection } from 'next/server';
import { sendQueuedEmails } from '@/lib/email-send';
import { siteOrigin } from '@/lib/site-origin';
import { authorised } from '@/lib/video-check';

// Once a day (vercel.json) as a catch-up: feedback also sends at once from the action, and this retries what failed.
export async function GET(request: Request) {
  await connection();
  if (!authorised(request.headers.get('authorization'), process.env.CRON_SECRET)) return new Response('Not allowed', { status: 401 });
  const result = await sendQueuedEmails(await siteOrigin());
  return result ? Response.json(result) : Response.json({ skipped: 'no email provider configured' });
}
